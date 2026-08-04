import { createDb } from '@crux/db';

export const db = createDb(process.env.DATABASE_URL!);
