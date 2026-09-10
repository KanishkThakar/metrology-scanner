import {cpSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
rmSync('dist', {recursive:true,force:true});
mkdirSync('dist');
cpSync('FRONTEND','dist',{recursive:true});
cpSync('backend/presets','dist/presets',{recursive:true});
const url = process.env.METROLOGY_API_URL || '';
if (url && !url.startsWith('https://')) throw new Error('METROLOGY_API_URL must use HTTPS');
writeFileSync('dist/config.js', `window.METROLOGY_API_URL = ${JSON.stringify(url)};\n`);
