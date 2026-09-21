import { Request, Response } from 'express';
import {compareSync, hashSync} from 'bcrypt';
import { prisma } from '../prisma';
import * as jwt from "jsonwebtoken";
import { JWT_SECRET } from '../secrets';

// မိမိ၏ prisma client path အတိုင်း ပြောင်းပါ

export const signup = async (req: Request, res: Response) => {
  try {
    // 1. Guard Clause: req.body undefined ဖြစ်နေပါက Crash မဖြစ်အောင် တားဆီးခြင်း
    const { email, password, name } = req.body || {};

    // 2. Validation: Input data ပြည့်စုံစွာ ပါမပါ စစ်ဆေးခြင်း
    if (!email || !password || !name) {
      res.status(400).json({ 
        message: "Validation Error: email, password, and name are required." 
      });
      return;
    }

    // 3. User ရှိပြီးသား ဟုတ်/မဟုတ် စစ်ဆေးခြင်း
    const existingUser = await prisma.user.findFirst({
      where: { email }
    });

    if (existingUser) {
      res.status(409).json({ message: "User already exists" });
      return;
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
    console.error("Signup Error:", error);

    // 5. Database Connection ကျတာ သို့မဟုတ် အခြား Error များအတွက် Handled response ပြန်ပေးခြင်း
    res.status(500).json({ 
      message: "Internal Server Error", 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
};

export const login = async (req: Request, res: Response) => {
   const {email , password } = req.body;

   let user = await prisma.user.findFirst({
    where:{email}
   })

   if(!user) {
    res.status(409).json({ message: "User does not exists" });
    return;
   }

   if(!compareSync(password , user.password)) {
    res.status(409).json({ message: "Incorrect Password" });
   }

   const token = jwt.sign({
    userId : user.id,
   },JWT_SECRET)
   res.json({user, token});
}

export default signup

