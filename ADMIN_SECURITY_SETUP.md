# 🔒 Admin Security Setup Instructions

## ⚠️ IMPORTANT: Change the Default Password!

Your admin page is now password protected, but you **MUST** change the default password immediately!

### Default Credentials (CHANGE THESE!)
- **Password:** `admin123`
- **Access URL:** `https://yoursite.netlify.app/admin.html`

## Setup Steps:

### 1. Generate a Secure Password Hash
Choose a strong password and generate its SHA-512 hash:

**Option A: Online Tool (Easiest)**
1. Go to: https://emn178.github.io/online-tools/sha512.html
2. Enter your new secure password
3. Copy the resulting hash

**Option B: PowerShell (Windows)**
```powershell
$password = "your_new_secure_password"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($password)
$hash = [System.Security.Cryptography.SHA512]::Create().ComputeHash($bytes)
[System.BitConverter]::ToString($hash).Replace("-", "").ToLower()
```

**Option C: Command Line (Mac/Linux)**
```bash
echo -n "your_new_secure_password" | sha512sum
```

### 2. Update Netlify Environment Variables
1. Go to your Netlify dashboard
2. Navigate to: Site Settings → Environment Variables
3. Add/Update this variable:
   - **Key:** `ADMIN_PASSWORD_HASH`
   - **Value:** Your generated hash from step 1

### 3. Deploy the Changes
The changes are ready to commit and deploy!

## Security Features Implemented:

✅ **Password Protection:** SHA-512 hashed passwords
✅ **Session Management:** 24-hour secure sessions
✅ **Server-side Validation:** All API calls require authentication
✅ **Automatic Logout:** Sessions expire and auto-logout
✅ **Brute Force Protection:** Login delays prevent attacks
✅ **Secure Storage:** Passwords never stored in plain text
✅ **IP Tracking:** Session tracking for security monitoring

## How It Works:

1. **Login Process:**
   - User enters password on admin.html
   - Password is hashed client-side and verified server-side
   - Secure session token is generated and stored

2. **Protected Access:**
   - All admin API calls require valid session token
   - Sessions automatically expire after 24 hours
   - Invalid sessions redirect to login page

3. **Automatic Security:**
   - Sessions are checked every minute
   - Expired sessions automatically log out
   - All admin functions require authentication

## Next Steps:
1. Change the default password hash (Step 1-2 above)
2. Test the admin login at `/admin.html`
3. Ensure all admin functions work correctly

**Your admin page is now secure! 🔐**
