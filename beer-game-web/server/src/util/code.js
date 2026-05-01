import { customAlphabet } from 'nanoid';

// 헷갈리기 쉬운 문자(0/O, 1/I/L) 제외한 알파벳
const SESSION_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const generateSessionCode = customAlphabet(SESSION_ALPHABET, 6);
export const generateAdminToken = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 32);
export const generatePlayerToken = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 32);
export const generateId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 16);
