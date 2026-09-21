import { ErrorCode, HttpException } from "./root";

export class BadRequestException extends HttpException {
    constructor(message: string, errorCode: ErrorCode, error?: any) {
        super(message, errorCode, 400, error);
    }
}