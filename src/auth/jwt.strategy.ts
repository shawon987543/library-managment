import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';


interface JWTPayload {
    sub: number;
    email: string;
}
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new Error('JWT_SECRET is not configured');
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    async validate(payload: { sub: number; email: string; role: 'USER'| 'ADMIN'; }){
        if(!payload.sub || !payload.email){
            throw new UnauthorizedException();
        }

        return{ 
            userId: payload.sub,
            email: payload.email,
            role: payload.role,
        };
    }
}