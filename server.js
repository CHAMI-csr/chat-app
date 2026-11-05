const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, 'apps/server/.env') });
require('./apps/server/dist/index.js');
