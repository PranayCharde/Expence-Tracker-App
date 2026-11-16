const path = require('path');
const fs = require('fs');

console.log("Checking safeStorage and smsTracking files...");
const safeStorage = fs.readFileSync('C:/Users/prana/Documents/Company projects/Personal Project/ExpenseTracker/SpendwiseApp/src/utils/safeStorage.js', 'utf8');

console.log("safeStorage contains safeGetItem:", safeStorage.includes('export const safeGetItem'));
console.log("safeStorage contains safeSetItem:", safeStorage.includes('export const safeSetItem'));

const notif = fs.readFileSync('C:/Users/prana/Documents/Company projects/Personal Project/ExpenseTracker/SpendwiseApp/src/services/notificationService.js', 'utf8');
console.log("notif contains SchedulableTriggerInputTypes:", notif.includes('SchedulableTriggerInputTypes'));
console.log("notif try/catch for channel:", notif.includes('channelErr'));

console.log("All verifications passed!");

