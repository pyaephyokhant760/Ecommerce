import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

export const PORT = process.env.PORT || 3000;
export const DATABASE_URL = process.env.DATABASE_URL;

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined in .env file');
}
export const JWT_SECRET: string = jwtSecret;