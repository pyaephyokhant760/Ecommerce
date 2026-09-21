import { Request, Response, NextFunction } from "express";
import { HttpException } from "../exceptions/root";

export const errorMiddleware = (
    err: HttpException,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // ၁။ HttpException ဖြစ်ရင် သူ့ statusCode/errorCode/errors တွေကို သုံး
    if (err instanceof HttpException) {
        return res.status(err.statusCode).json({
            message: err.message,
            errorCode: err.errorCode,
            errors: err.errors ?? null,
        });
    }

    // ၂။ မဟုတ်ရင် unknown error — 500 ပြန်
    return res.status(500).json({
        message: err?.message || "Internal Server Error",
        errorCode: "INTERNAL_SERVER_ERROR",
        errors: null,
    });
};