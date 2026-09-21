export class HttpException extends Error {
    massage: string;
    errorcode : any;
    statusCode : number;
    error : any;
    constructor(message: string, statusCode: number, errorcode?: any, error?: any) {
        super(message);
        this.massage = message;
        this.statusCode = statusCode;
        this.errorcode = errorcode;
        this.error = error;
        
    }
}

export enum ErrorCode {
    USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
    DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    NOT_FOUND = 'NOT_FOUND',
    BAD_REQUEST = 'BAD_REQUEST'
} 