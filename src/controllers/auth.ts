import { Request, Response , NextFunction} from 'express';
import {compareSync, hashSync} from 'bcrypt';
import { prisma } from '../prisma';
import * as jwt from "jsonwebtoken";
import { JWT_SECRET } from '../secrets';
import { BadRequestException } from '../exceptions/bad_request';
import { ErrorCode, HttpException } from '../exceptions/root';




// မိမိ၏ prisma client path အတိုင်း ပြောင်းပါ

export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Guard Clause: req.body undefined ဖြစ်နေပါက Crash မဖြစ်အောင် တားဆီးခြင်း
    const { email, password, name } = req.body || {};

    // 2. Validation: Input data ပြည့်စုံစွာ ပါမပါ စစ်ဆေးခြင်း
    if (!email || !password || !name) {
      throw new BadRequestException(
        "Validation Error: email, password, and name are required.",
        ErrorCode.VALIDATION_ERROR
      );
    }

    // 3. User ရှိပြီးသား ဟုတ်/မဟုတ် စစ်ဆေးခြင်း
    const existingUser = await prisma.user.findFirst({
      where: { email }
    });

    if (existingUser) {
      throw new BadRequestException("User already exists", ErrorCode.USER_ALREADY_EXISTS);
    }

    // 4. User အသစ် ဆောက်ခြင်း
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashSync(password, 10)
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
        // password Hash ကို response ထဲ မပါစေရန်  বাদထားခဲ့ပါသည်
      }
    });

    res.status(201).json(newUser);

  } catch (error) {
    // This catch used to swallow BadRequestException and turn every throw into
    // a 500. Exceptions must reach src/middlewares/errorHandler.ts so the client
    // gets the intended status code and errorCode.
    if (error instanceof HttpException) {
      throw error;
    }

    console.error("Signup Error:", error);

    // 5. Unexpected failure (e.g. database connection): log it, leak nothing.
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req: Request, res: Response) => {
   const {email , password } = req.body;

   let user = await prisma.user.findFirst({
    where:{email}
   })

   if(!user) {
    throw new BadRequestException("User not found", ErrorCode.USER_NOT_FOUND);
   }

   if(!compareSync(password , user.password)) {
    throw new BadRequestException("Invalid credentials", ErrorCode.INVALID_CREDENTIALS);
   }

   const token = jwt.sign({
    userId : user.id,
   },JWT_SECRET)
   res.json({user, token});
}

export default signup

