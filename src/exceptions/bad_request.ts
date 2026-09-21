import { ErrorCode, HttpException } from "./root";

export class BadRequestException extends HttpException {
    constructor(message: string, error?: any, ErrorCode?: any) {
        super(message, 400, ErrorCode.BAD_REQUEST, error);
    }
}