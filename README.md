# SpendWise Mobile App (React Native & Expo)

A cross-platform personal finance & cash wallet manager built with **React Native (Expo SDK 58)**, **Firebase Auth & Firestore**, and styled with an emerald theme matching the **SpendWise** web dashboard.

---

## 🚀 Features

- **Full Parity with Web App**:
  - **Shared Firebase Backend**: Seamless real-time sync with the web version using Firestore (`spendwise-tracker-pranay-13`).
  - **Hero Physical Wallet**: Real-time Indian note denomination breakdown (₹500, ₹200, ₹100, ₹50, ₹20, ₹10, and loose coins).
  - **Recount & Audit Reconciliation**:
    - Physical wallet bill counter with `+` / `-` steppers.
    - Automatic difference & variance detection (`+₹X.XX untracked cash in` / `-₹X.XX untracked cash spent`).
    - One-tap "Auto-adjust app cash balance" to synchronize your recorded Cash in Hand with your physical wallet.
  - **Transactions Hub**: Filter transactions by Cash, Online, or All, search, view receipt attachments, and view denomination breakdowns.
  - **Spend Cash Modal**: Dedicated cash spending interface where users select the exact bills pulled from their pocket with real-time remaining note balance checks.
  - **Budgets**: Set category budget limits, visual progress bars, percentage alerts, and warnings.
  - **Reports & Analytics**: Savings rate, monthly cash vs. online dual-bar comparison, and top spending categories breakdown.
  - **Settings & Preferences**: Currency preference (default `INR ₹`), Dark Mode / Light Mode toggle, and IST (GMT+5:30) timezone awareness.

---

## 📱 How to Run the App

### 1. Start Metro Development Server
Navigate to the app directory and start Expo:
```bash
cd "C:\Users\prana\Documents\Company projects\Personal Project\ExpenseTracker\SpendwiseApp"
npm start
```

### 2. Run on Your Physical Phone (Recommended)
1. Install the **Expo Go** app from Google Play Store or Apple App Store.
2. Scan the QR code displayed in the terminal using the Expo Go camera (Android) or default Camera app (iOS).
3. The app will bundle and load directly on your phone with hot reload enabled!

### 3. Run on Android Emulator / Web
- Press `a` in the terminal to launch the Android emulator.
- Press `w` in the terminal to open the web preview.

---

## 📁 Project Structure

```
SpendwiseApp/
├── assets/                  # App icon, splash screen, and logo
├── src/
│   ├── components/
│   │   ├── common/          # Button, Card, Badge, Logo
│   │   └── modals/          # SpendCashModal, NewTransactionModal, TransactionDetailModal
│   ├── config/              # Firebase configuration & constants
│   ├── context/             # AuthContext & SettingsContext
│   ├── navigation/          # AppNavigator (Tabs & Stacks)
│   ├── screens/
│   │   ├── auth/            # LoginScreen & SignupScreen
│   │   ├── dashboard/       # DashboardScreen (Overview)
│   │   ├── cash/            # CashWalletScreen (Recount, Audit & Denominations)
│   │   ├── transactions/    # TransactionsScreen (Search & Filter)
│   │   ├── budgets/         # BudgetsScreen (Limits & Progress)
│   │   ├── reports/         # ReportsScreen (Analytics & Visuals)
│   │   └── settings/        # SettingsScreen (Theme, Currency & Profile)
│   └── theme/               # Colors & styling tokens
├── App.js                   # Application root
└── app.json                 # Expo app configuration
```

