import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP configuration is missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: SendEmailOptions) => {
  const mailTransporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@gymnet.app';

  try {
    await mailTransporter.sendMail({
      from,
      to,
      subject,
      html,
    });
    console.log(`[EmailService] Sent mail to ${to} | subject="${subject}"`);
  } catch (error) {
    console.error(`[EmailService] Failed to send mail to ${to} | subject="${subject}"`, error);
    throw error;
  }
};

export const sendMealReminderEmail = async (params: {
  to: string;
  userName: string;
  dateLabel: string;
  time: string;
  mealName: string;
}) => {
  const { to, userName, dateLabel, time, mealName } = params;
  const subject = `Nhắc nhở bữa ăn ${mealName} lúc ${time}`;
  const html = `
    <h2>Xin chào ${userName},</h2>
    <p>Bạn có kế hoạch ăn <strong>${mealName}</strong> vào lúc <strong>${time}</strong> ngày <strong>${dateLabel}</strong>.</p>
    <p>Nhớ chuẩn bị trước để đảm bảo dinh dưỡng nhé!</p>
    <p>Chúc bạn một ngày tốt lành!</p>
    <p>GymNet</p>
  `;

  await sendEmail({ to, subject, html });
};

export const sendExerciseReminderEmail = async (params: {
  to: string;
  userName: string;
  dateLabel: string;
  time: string;
  exerciseName: string;
}) => {
  const { to, userName, dateLabel, time, exerciseName } = params;
  const subject = `Nhắc nhở tập luyện ${exerciseName} lúc ${time}`;
  const html = `
    <h2>Xin chào ${userName},</h2>
    <p>Bạn có lịch tập <strong>${exerciseName}</strong> vào lúc <strong>${time}</strong> ngày <strong>${dateLabel}</strong>.</p>
    <p>Chuẩn bị đồ tập và khởi động nhẹ để đạt hiệu quả tốt nhất!</p>
    <p>Chúc bạn một ngày tốt lành!</p>
    <p>GymNet</p>
  `;

  await sendEmail({ to, subject, html });
};


