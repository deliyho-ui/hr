# HR-AI Dashboard

דאשבורד ניהול גיוס שמתחבר ל־Firebase הקיים של דף הנחיתה.

## מה יש כאן

- כניסה דרך Firebase Auth
- KPI עליון: מאגר מלא, מאגר מסונן, ממתינים לבדיקה, חסרי AI, מומלצים בכוכב
- מאגר מלא עם חלוקה לפי ירוק / כתום / אפור / אדום
- מאגר מסונן: ירוקים בלבד
- ממתינים לבדיקה: אפורים וכתומים
- מומלצים בכוכב: חבר מביא חבר / סימון מגייס
- כרטיס מועמד עם שאלון, תקציר AI אם קיים, קורות חיים, הערות מגייס, היסטוריה וסרגל תהליך
- מצב fallback: אם אין ניתוח AI, המועמד מוצג באפור עם תג בולט
- הוספת מועמד ידנית מתוך הדאשבורד, כולל "הומלץ ע״י" וסימון אוטומטי בכוכב
- מחיקת מועמד מתוך הדאשבורד, כולל ניסיון למחוק את קובץ קורות החיים מה־Storage
- עריכת פרופיל מגייס מתוך הדאשבורד
- לוג פעולות ב־Firestore תחת `auditLogs`
- ייצוא מאגר מועמדים לקובץ CSV
- כפתור ניתוח AI למועמד ושמירת תוצאה תחת `candidates/{candidateId}.aiAnalysis`

## Firebase שצריך להפעיל

1. Authentication -> Sign-in method -> Email/Password
2. ליצור משתמש מגייס ראשון
3. לפרסם את `firestore.rules`
4. לפרסם את `storage.rules`

## שם תצוגה למגייס

אפשר לעדכן את שם המגייס ישירות מתוך הדאשבורד במסך `הגדרות סף`.

אם רוצים ליצור ידנית בפיירבייס:

1. נכנסים ל־Firebase -> Authentication -> Users
2. מעתיקים את ה־UID של המשתמש
3. נכנסים ל־Firestore -> Data
4. יוצרים Collection בשם `recruiters`
5. יוצרים Document עם אותו UID
6. מוסיפים שדות:

```txt
displayName: "דניאל אליהו"
role: "מנהל מערכת"
email: "deliyho@gmail.com"
```

אם אין מסמך כזה, הדאשבורד יציג את האימייל כגיבוי.

## לוג פעולות וייצוא

הדאשבורד שומר פעולות משמעותיות ב־Firestore תחת Collection בשם `auditLogs`:

- הוספת מועמד ידנית
- עדכון סטטוס / סיווג
- סימון והסרת כוכב
- פתיחת קורות חיים
- מחיקת מועמד
- ייצוא CSV
- עדכון פרופיל מגייס

כפתור `ייצוא CSV` מוריד את כל מאגר המועמדים לקובץ CSV מקומי.

## הערה על אימות דו שלבי במייל

Firebase Auth לא מספק כפתור מובנה של קוד חד־פעמי במייל עבור Email/Password בדאשבורד סטטי. כדי לעשות זאת נכון צריך להוסיף פונקציית שרת ששולחת קוד במייל ובודקת אותו לפני פתיחת הדאשבורד, או להשתמש ב־MFA מובנה של Firebase/Identity Platform כמו TOTP או SMS. כרגע הכניסה נעולה לפי משתמשי Firebase Auth, והשלב הבא הוא לבחור את שיטת ה־2FA.

## אימות דו שלבי TOTP

הדאשבורד כולל תמיכה ב־TOTP לאחר שמפעילים אותו בפרויקט Firebase דרך Identity Platform.

בכניסה הראשונה של מגייס:

1. המגייס נכנס עם אימייל וסיסמה
2. אם עדיין אין לו TOTP, יוצג QR
3. סורקים את ה־QR עם Google Authenticator / Microsoft Authenticator
4. מזינים את הקוד הראשון
5. מכאן והלאה כל כניסה תדרוש קוד TOTP

אם Firebase דורש אימייל מאומת, הדאשבורד ינסה לשלוח אימייל אימות. אחרי האימות צריך לצאת ולהיכנס מחדש.

## הערה על AI

ה־AI לא יושב ב־Firebase. Firebase שומר מועמדים, שאלונים, קורות חיים והגדרות סף. פונקציית שרת ב־Vercel תחת `api/analyze-candidate.js` קוראת את המועמד, את קורות החיים ואת `settings/screening`, מפעילה מודל AI, ושומרת את `aiAnalysis` בחזרה למסמך המועמד.

כדי להפעיל את פונקציית ה־AI ב־Vercel צריך להגדיר Environment Variables:

```txt
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
FIREBASE_STORAGE_BUCKET=hr-ai-50d43.firebasestorage.app
FIREBASE_SERVICE_ACCOUNT_JSON={...}
```

אפשר להשתמש במקום זאת גם ב־`FIREBASE_SERVICE_ACCOUNT_BASE64` אם נוח יותר לשמור את JSON השירות כ־Base64.

חשוב: `FIREBASE_SERVICE_ACCOUNT_JSON` הוא כל התוכן של קובץ ה־JSON שיורד מ־Firebase, לא קטע הקוד של Admin SDK. אם חסר המשתנה הזה או שהוא לא JSON תקין, הדאשבורד יטען מועמדים אבל ניתוח AI ייכשל.

הקוד לא משתמש בחבילת SDK חיצונית ל־AI. הוא שולח בקשת HTTP רגילה ל־Anthropic Messages API. ברירת המחדל היא:

```txt
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
ANTHROPIC_VERSION=2023-06-01
ANTHROPIC_MAX_TOKENS=1800
```

ברוב המקרים מספיק להגדיר רק `ANTHROPIC_API_KEY`. קיימים גם שמות גיבוי למפתח ולמודל: `CLAUDE_API_KEY`, `CLAUDE_MODEL`, `AI_MODEL`.

אם רוצים מודל זול ומהיר יותר, אפשר להגדיר:

```txt
ANTHROPIC_MODEL=claude-3-5-haiku-20241022
```

אם בוחרים מודל אחר מתוך Claude Console, יש להעתיק את שם המודל המדויק כפי שהוא מופיע שם. אם שם המודל לא נתמך ב־Anthropic Messages API, המועמד יסומן כ־`ניתוח נכשל` עם הודעת שגיאה.

הפונקציה מאמתת את המשתמש עם Firebase Auth ID token, כך שרק משתמש מחובר לדאשבורד יכול להפעיל ניתוח.

## בדיקת תקלות AI

אם לחיצה על `ניתוח AI` לא מחזירה תוצאה:

1. ב־Vercel נכנסים לפרויקט -> Logs.
2. לוחצים שוב על `ניתוח AI` בדאשבורד.
3. בודקים את השגיאה האחרונה.

שגיאות נפוצות:

```txt
Missing Firebase Admin credentials
```

חסר `FIREBASE_SERVICE_ACCOUNT_JSON` או `FIREBASE_SERVICE_ACCOUNT_BASE64`.

```txt
FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON
```

הודבק קטע קוד במקום קובץ JSON מלא, או שה־JSON נשבר בזמן ההדבקה.

```txt
Missing Claude API key
```

חסר `ANTHROPIC_API_KEY` או `CLAUDE_API_KEY`.

```txt
AI provider request failed
```

בדרך כלל מפתח Claude שגוי, אין Billing/Credits, או שם מודל לא נתמך.

## הגדרות סף ל־AI

במסך `הגדרות סף` נשמר מסמך:

```txt
settings/screening
```

השדות המרכזיים:

```txt
greenThreshold
orangeThreshold
licenseRequirement
screeningPrompt
successProfile
```

ה־AI קורא את ההגדרות האלה בזמן הניתוח. אפשר להרחיב את המסמך בהמשך עם עוד תנאים, דוגמאות עבר, פסילות קשיחות או עדיפויות.

## פריסה

אפשר להעלות את התיקייה ל־Vercel כאתר סטטי. הקובץ הראשי הוא `index.html`.
