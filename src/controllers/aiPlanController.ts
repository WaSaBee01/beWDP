import { GoogleGenerativeAI } from '@google/generative-ai';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Exercise, Meal, Plan, User, UserSurvey, WeeklyPlan } from '../models';

const GEMINI_API_KEY = 'AIzaSyC06b8exJ26e7YGlJnCgXRZ4VMV_sOGmWw';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Generate daily plan with AI

// Generate weekly plan with AI
export const generateWeeklyPlan = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Check if user is premium/VIP
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    const isPremium = user.subscriptionStatus === 'premium' || 
      (user.isVip && user.vipExpiresAt && new Date(user.vipExpiresAt) > new Date());

    if (!isPremium) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Tính năng này chỉ dành cho thành viên Premium',
      });
    }

    const { prompt } = req.body as { prompt?: string };

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Prompt không được để trống',
      });
    }

    // Get user survey
    const survey = await UserSurvey.findOne({ userId: req.user._id });

    if (!survey) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Vui lòng hoàn thành khảo sát trước khi sử dụng tính năng AI',
      });
    }

    // Build context from survey
    const surveyContext = `
Thông tin người dùng:
- Mục tiêu: ${survey.goal === 'weight_loss' ? 'Giảm cân' : survey.goal === 'muscle_gain' ? 'Tăng cơ' : 'Sống khỏe'}
- Cân nặng: ${survey.weight} kg
- Chiều cao: ${survey.height} cm
- BMI: ${survey.bmi.toFixed(1)}
- Số ngày tập luyện/tuần: ${survey.workoutDays}
- Thời gian tập mỗi buổi: ${survey.workoutDuration} phút
- Mức độ: ${survey.fitnessLevel === 'beginner' ? 'Người mới' : survey.fitnessLevel === 'intermediate' ? 'Trung bình' : 'Nâng cao'}
${survey.gender ? `- Giới tính: ${survey.gender === 'male' ? 'Nam' : 'Nữ'}` : ''}
${survey.age ? `- Tuổi: ${survey.age}` : ''}
${survey.allergies && survey.allergies.length > 0 ? `- Dị ứng: ${survey.allergies.join(', ')}` : ''}
${survey.dailyCalories ? `- Calo mục tiêu/ngày: ${survey.dailyCalories}` : ''}
`;

    const fullPrompt = `${surveyContext}

Yêu cầu người dùng: ${prompt}

Hãy tạo một kế hoạch dinh dưỡng và luyện tập cho 7 ngày (thứ 2 đến chủ nhật) với cấu trúc JSON sau:

{
  "name": "Tên kế hoạch tuần",
  "description": "Mô tả ngắn gọn về kế hoạch tuần",
  "days": {
    "monday": {
      "name": "Tên kế hoạch ngày thứ 2",
      "description": "Mô tả",
      "meals": [
        {
          "time": "07:30",
          "meal": {
            "name": "Tên món ăn",
            "description": "Mô tả món ăn",
            "ingredients": [
              {
                "name": "Tên thành phần",
                "weightGram": 50
              }
            ],
            "calories": 350,
            "carbs": 45,
            "protein": 25,
            "fat": 10,
            "weightGrams": 200
          }
        }
      ],
      "exercises": [
        {
          "time": "18:00",
          "exercise": {
            "name": "Tên bài tập",
            "description": "Mô tả bài tập",
            "durationMinutes": 30,
            "caloriesBurned": 200,
            "difficulty": "basic"
          }
        }
      ]
    },
    "tuesday": { ... },
    "wednesday": { ... },
    "thursday": { ... },
    "friday": { ... },
    "saturday": { ... },
    "sunday": { ... }
  }
}

Lưu ý:
- Tạo đầy đủ 7 ngày (monday, tuesday, wednesday, thursday, friday, saturday, sunday)
- Mỗi ngày có ít nhất 3 bữa ăn và ít nhất 1 bài tập
- Mỗi món ăn phải có mảng ingredients với các thành phần và khối lượng (weightGram) tương ứng
- Tổng weightGram của tất cả ingredients phải bằng weightGrams của món ăn
- Đảm bảo tổng calo nạp vào mỗi ngày phù hợp với mục tiêu (khoảng ${survey.dailyCalories || 2000} cal)
- Thời gian bữa ăn và bài tập phải hợp lý
- difficulty phải là: "basic", "intermediate", hoặc "advanced"
- Có thể thay đổi bài tập và món ăn giữa các ngày để đa dạng
- Chỉ trả về JSON, không có text thêm`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response
    let planData;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;
      planData = JSON.parse(jsonText.trim());
    } catch {
      console.error('Failed to parse AI response:', text);
      return res.status(500).json({
        error: 'Parse error',
        message: 'Không thể phân tích phản hồi từ AI. Vui lòng thử lại.',
      });
    }

    // Validate structure
    if (!planData.name || !planData.days || typeof planData.days !== 'object') {
      return res.status(500).json({
        error: 'Invalid structure',
        message: 'Cấu trúc dữ liệu từ AI không hợp lệ',
      });
    }

    return res.status(200).json({
      success: true,
      data: planData,
    });
  } catch (error) {
    console.error('Error generating weekly plan:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Không thể tạo kế hoạch với AI',
    });
  }
};

// Accept and create daily plan from AI
export const acceptDailyPlan = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const planData = req.body as {
      name: string;
      description?: string;
      meals: Array<{ 
        time: string; 
        meal: { 
          name: string; 
          description?: string; 
          ingredients?: Array<{ name: string; weightGram: number }>;
          calories: number; 
          carbs: number; 
          protein: number; 
          fat: number; 
          weightGrams: number 
        } 
      }>;
      exercises: Array<{ time: string; exercise: { name: string; description?: string; durationMinutes: number; caloriesBurned: number; difficulty: string } }>;
    };

    if (!planData.name || !Array.isArray(planData.meals) || !Array.isArray(planData.exercises)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Dữ liệu kế hoạch không hợp lệ',
      });
    }

    // Create meals
    const mealIds: string[] = [];
    for (const mealItem of planData.meals) {
      const meal = await Meal.create({
        name: mealItem.meal.name,
        description: mealItem.meal.description || '',
        ingredients: mealItem.meal.ingredients || [],
        calories: mealItem.meal.calories,
        carbs: mealItem.meal.carbs,
        protein: mealItem.meal.protein,
        fat: mealItem.meal.fat,
        weightGrams: mealItem.meal.weightGrams,
        isCommon: false,
        createdBy: req.user._id,
      });
      mealIds.push(String(meal._id));
    }

    // Create exercises
    const exerciseIds: string[] = [];
    for (const exItem of planData.exercises) {
      const exercise = await Exercise.create({
        name: exItem.exercise.name,
        description: exItem.exercise.description || '',
        durationMinutes: exItem.exercise.durationMinutes,
        caloriesBurned: exItem.exercise.caloriesBurned,
        difficulty: exItem.exercise.difficulty as 'basic' | 'intermediate' | 'advanced',
        isCommon: false,
        createdBy: req.user._id,
      });
      exerciseIds.push(String(exercise._id));
    }

    // Calculate totals
    const totals = {
      caloriesIn: planData.meals.reduce((sum, m) => sum + m.meal.calories, 0),
      carbs: planData.meals.reduce((sum, m) => sum + m.meal.carbs, 0),
      protein: planData.meals.reduce((sum, m) => sum + m.meal.protein, 0),
      fat: planData.meals.reduce((sum, m) => sum + m.meal.fat, 0),
      caloriesOut: planData.exercises.reduce((sum, e) => sum + e.exercise.caloriesBurned, 0),
    };

    // Create plan
    const plan = await Plan.create({
      name: planData.name,
      description: planData.description || '',
      isCommon: false,
      createdBy: req.user._id,
      meals: planData.meals.map((m, idx) => ({
        time: m.time,
        meal: mealIds[idx],
      })),
      exercises: planData.exercises.map((e, idx) => ({
        time: e.time,
        exercise: exerciseIds[idx],
      })),
      totals,
    });

    return res.status(201).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error('Error accepting daily plan:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Không thể tạo kế hoạch',
    });
  }
};

// Accept and create weekly plan from AI
export const acceptWeeklyPlan = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const planData = req.body as {
      name: string;
      description?: string;
      days: {
        monday?: { name: string; description?: string; meals: Array<{ time: string; meal: { name: string; description?: string; ingredients?: Array<{ name: string; weightGram: number }>; calories: number; carbs: number; protein: number; fat: number; weightGrams: number } }>; exercises: Array<{ time: string; exercise: { name: string; description?: string; durationMinutes: number; caloriesBurned: number; difficulty: string } }> };
        tuesday?: { name: string; description?: string; meals: Array<{ time: string; meal: { name: string; description?: string; ingredients?: Array<{ name: string; weightGram: number }>; calories: number; carbs: number; protein: number; fat: number; weightGrams: number } }>; exercises: Array<{ time: string; exercise: { name: string; description?: string; durationMinutes: number; caloriesBurned: number; difficulty: string } }> };
        wednesday?: { name: string; description?: string; meals: Array<{ time: string; meal: { name: string; description?: string; ingredients?: Array<{ name: string; weightGram: number }>; calories: number; carbs: number; protein: number; fat: number; weightGrams: number } }>; exercises: Array<{ time: string; exercise: { name: string; description?: string; durationMinutes: number; caloriesBurned: number; difficulty: string } }> };
        thursday?: { name: string; description?: string; meals: Array<{ time: string; meal: { name: string; description?: string; ingredients?: Array<{ name: string; weightGram: number }>; calories: number; carbs: number; protein: number; fat: number; weightGrams: number } }>; exercises: Array<{ time: string; exercise: { name: string; description?: string; durationMinutes: number; caloriesBurned: number; difficulty: string } }> };
        friday?: { name: string; description?: string; meals: Array<{ time: string; meal: { name: string; description?: string; ingredients?: Array<{ name: string; weightGram: number }>; calories: number; carbs: number; protein: number; fat: number; weightGrams: number } }>; exercises: Array<{ time: string; exercise: { name: string; description?: string; durationMinutes: number; caloriesBurned: number; difficulty: string } }> };
        saturday?: { name: string; description?: string; meals: Array<{ time: string; meal: { name: string; description?: string; ingredients?: Array<{ name: string; weightGram: number }>; calories: number; carbs: number; protein: number; fat: number; weightGrams: number } }>; exercises: Array<{ time: string; exercise: { name: string; description?: string; durationMinutes: number; caloriesBurned: number; difficulty: string } }> };
        sunday?: { name: string; description?: string; meals: Array<{ time: string; meal: { name: string; description?: string; ingredients?: Array<{ name: string; weightGram: number }>; calories: number; carbs: number; protein: number; fat: number; weightGrams: number } }>; exercises: Array<{ time: string; exercise: { name: string; description?: string; durationMinutes: number; caloriesBurned: number; difficulty: string } }> };
      };
    };

    if (!planData.name || !planData.days) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Dữ liệu kế hoạch tuần không hợp lệ',
      });
    }

    // Create daily plans for each day
    const dayPlanIds: Record<string, string> = {};
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

    for (const dayKey of dayKeys) {
      const dayData = planData.days[dayKey];
      if (!dayData) continue;

      // Create meals for this day
      const mealIds: string[] = [];
      for (const mealItem of dayData.meals) {
        const meal = await Meal.create({
          name: mealItem.meal.name,
          description: mealItem.meal.description || '',
          ingredients: mealItem.meal.ingredients || [],
          calories: mealItem.meal.calories,
          carbs: mealItem.meal.carbs,
          protein: mealItem.meal.protein,
          fat: mealItem.meal.fat,
          weightGrams: mealItem.meal.weightGrams,
          isCommon: false,
          createdBy: req.user._id,
        });
        mealIds.push(String(meal._id));
      }

      // Create exercises for this day
      const exerciseIds: string[] = [];
      for (const exItem of dayData.exercises) {
        const exercise = await Exercise.create({
          name: exItem.exercise.name,
          description: exItem.exercise.description || '',
          durationMinutes: exItem.exercise.durationMinutes,
          caloriesBurned: exItem.exercise.caloriesBurned,
          difficulty: exItem.exercise.difficulty as 'basic' | 'intermediate' | 'advanced',
          isCommon: false,
          createdBy: req.user._id,
        });
        exerciseIds.push(String(exercise._id));
      }

      // Calculate totals
      const totals = {
        caloriesIn: dayData.meals.reduce((sum, m) => sum + m.meal.calories, 0),
        carbs: dayData.meals.reduce((sum, m) => sum + m.meal.carbs, 0),
        protein: dayData.meals.reduce((sum, m) => sum + m.meal.protein, 0),
        fat: dayData.meals.reduce((sum, m) => sum + m.meal.fat, 0),
        caloriesOut: dayData.exercises.reduce((sum, e) => sum + e.exercise.caloriesBurned, 0),
      };

      // Create daily plan
      const dailyPlan = await Plan.create({
        name: dayData.name || `${planData.name} - ${dayKey}`,
        description: dayData.description || '',
        isCommon: false,
        createdBy: req.user._id,
        meals: dayData.meals.map((m, idx) => ({
          time: m.time,
          meal: mealIds[idx],
        })),
        exercises: dayData.exercises.map((e, idx) => ({
          time: e.time,
          exercise: exerciseIds[idx],
        })),
        totals,
      });

      dayPlanIds[dayKey] = String(dailyPlan._id);
    }

    // Calculate totals for weekly plan (sum of all days)
    const weeklyTotals = {
      caloriesIn: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
      caloriesOut: 0,
    };

    // Sum up totals from all daily plans
    for (const dayKey of dayKeys) {
      if (dayPlanIds[dayKey]) {
        const dailyPlan = await Plan.findById(dayPlanIds[dayKey]);
        if (dailyPlan && dailyPlan.totals) {
          weeklyTotals.caloriesIn += dailyPlan.totals.caloriesIn || 0;
          weeklyTotals.carbs += dailyPlan.totals.carbs || 0;
          weeklyTotals.protein += dailyPlan.totals.protein || 0;
          weeklyTotals.fat += dailyPlan.totals.fat || 0;
          weeklyTotals.caloriesOut += dailyPlan.totals.caloriesOut || 0;
        }
      }
    }

    // Create weekly plan
    const weeklyPlan = await WeeklyPlan.create({
      name: planData.name,
      description: planData.description || '',
      isCommon: false,
      createdBy: req.user._id,
      days: dayPlanIds,
      totals: weeklyTotals,
    });

    return res.status(201).json({
      success: true,
      data: weeklyPlan,
    });
  } catch (error) {
    console.error('Error accepting weekly plan:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Không thể tạo kế hoạch tuần',
    });
  }
};

// Calculate nutrition from meal name and weight
export const calculateMealNutrition = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { mealName, ingredients, weightGrams } = req.body as { 
      mealName?: string; 
      ingredients?: Array<{ name: string; weightGram: number }>; 
      weightGrams?: number 
    };

    if (!mealName || !mealName.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Tên món ăn không được để trống',
      });
    }

    if (!weightGrams || weightGrams <= 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Khối lượng phải lớn hơn 0',
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Format ingredients text
    let ingredientsText = '';
    if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
      const ingredientsList = ingredients
        .filter(ing => ing.name && ing.name.trim() && ing.weightGram > 0)
        .map(ing => `- ${ing.name.trim()}: ${ing.weightGram}g`)
        .join('\n');
      if (ingredientsList) {
        ingredientsText = `\nThành phần:\n${ingredientsList}`;
      }
    }
    
    const prompt = `Bạn là chuyên gia dinh dưỡng. Hãy tính toán giá trị dinh dưỡng cho món ăn sau đây:

Tên món ăn: ${mealName}${ingredientsText}
Khối lượng tổng: ${weightGrams} gram

Hãy trả về kết quả dưới dạng JSON với format sau (chỉ trả về JSON, không có text khác):
{
  "calories": <số calo>,
  "carbs": <số gram carbs>,
  "protein": <số gram protein>,
  "fat": <số gram fat>
}

Lưu ý:
- Tính toán dựa trên tổng khối lượng ${weightGrams} gram của món ăn "${mealName}"${ingredientsText ? ` với các thành phần đã liệt kê` : ''}
- Tính toán chính xác dựa trên từng thành phần và khối lượng của chúng
- Sử dụng dữ liệu dinh dưỡng thực tế và chính xác cho từng thành phần
- Tổng hợp giá trị dinh dưỡng của tất cả thành phần lại với nhau`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    let nutritionData;
    try {
      // Try to parse as JSON directly
      nutritionData = JSON.parse(text.trim());
    } catch {
      // If direct parse fails, try to extract JSON from text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        nutritionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Không thể parse kết quả từ AI');
      }
    }

    // Validate response
    if (
      typeof nutritionData.calories !== 'number' ||
      typeof nutritionData.carbs !== 'number' ||
      typeof nutritionData.protein !== 'number' ||
      typeof nutritionData.fat !== 'number'
    ) {
      return res.status(500).json({
        error: 'Invalid response',
        message: 'Kết quả từ AI không hợp lệ',
      });
    }

    // Ensure values are positive
    nutritionData.calories = Math.max(0, Math.round(nutritionData.calories));
    nutritionData.carbs = Math.max(0, Math.round(nutritionData.carbs * 10) / 10);
    nutritionData.protein = Math.max(0, Math.round(nutritionData.protein * 10) / 10);
    nutritionData.fat = Math.max(0, Math.round(nutritionData.fat * 10) / 10);

    return res.status(200).json({
      success: true,
      data: nutritionData,
    });
  } catch (error) {
    console.error('Error calculating meal nutrition:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Không thể tính toán giá trị dinh dưỡng',
    });
  }
};

