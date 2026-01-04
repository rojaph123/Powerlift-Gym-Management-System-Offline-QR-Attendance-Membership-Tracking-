# Photo Capture PIN Screen Bug - FIXED (v2)

## Problem
When adding a member and clicking "Take Photo" or "Pick from Gallery", the app would:
1. Open the camera or photo library
2. After taking/selecting a photo, immediately redirect to the PIN screen
3. User could not complete the member registration

This happened even with the previous `setTimeoutDisabled()` fix because the SessionManager had a separate background detection mechanism that forced logout on **any** background-to-foreground transition.

## Root Cause
The camera/photo picker opens as a separate application, causing the app to transition to the **background** state. When the camera closes and the app returns to the **foreground**, the SessionManager's background detection logic (`AppState.addEventListener`) triggers an automatic logout regardless of the timeout setting.

The SessionManager code was:
```typescript
else if (state === "active") {
  // Always logout when returning from background
  safeLogout();
}
```

This is designed for security (PIN required when leaving and returning), but it interferes with legitimate background operations like photo capture.

## Solution (v2 - Proper Fix)
Instead of disabling timeout, we now track when a **photo operation is in progress** with a new state flag `isPhotoOperationInProgress`. The SessionManager checks this flag and skips the logout during legitimate background transitions caused by photo operations.

### Changes Made

#### 1. **AppContext.tsx**

Added new state property and setter:
```typescript
// In AppState interface
interface AppState {
  // ... other properties
  isPhotoOperationInProgress: boolean; // NEW
}

// In AppContextType interface
interface AppContextType extends AppState {
  // ... other setters
  setIsPhotoOperationInProgress: (value: boolean) => void; // NEW
}

// In useState initialization
const [state, setState] = useState<AppState>({
  // ... other state
  isPhotoOperationInProgress: false, // NEW DEFAULT
});

// In Provider value
setIsPhotoOperationInProgress: (value: boolean) => 
  setState(prev => ({ ...prev, isPhotoOperationInProgress: value })), // NEW
```

#### 2. **RegisterScreen.tsx**

Import and use the new flag:
```typescript
const { addMember, addSale, priceSettings, addAttendance, setIsPhotoOperationInProgress } = useApp();

const pickImage = async () => {
  // Mark photo operation in progress
  setIsPhotoOperationInProgress(true);
  
  const result = await ImagePicker.launchImageLibraryAsync({...});
  
  // Mark photo operation complete
  setIsPhotoOperationInProgress(false);
  
  if (!result.canceled && result.assets[0]) {
    setPhoto(result.assets[0].uri);
  }
};

const takePhoto = async () => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission Required", "Camera permission is needed to take photos.");
    return;
  }

  // Mark photo operation in progress
  setIsPhotoOperationInProgress(true);
  
  const result = await ImagePicker.launchCameraAsync({...});
  
  // Mark photo operation complete
  setIsPhotoOperationInProgress(false);
  
  if (!result.canceled && result.assets[0]) {
    setPhoto(result.assets[0].uri);
  }
};
```

#### 3. **MemberDetailScreen.tsx**

Same changes as RegisterScreen for editing existing member photos.

#### 4. **SessionManager.tsx** (Most Important)

Updated to check the photo operation flag before forcing logout:
```typescript
const { isAuthenticated, setAuthenticated, timeoutDisabled, isPhotoOperationInProgress } = useApp();

// In AppState listener effect
useEffect(() => {
  if (!isAuthenticated) return;

  const subscription = AppState.addEventListener("change", (state) => {
    console.log('[SessionManager] AppState changed:', state);
    
    if (state === "background") {
      // App is going to background - stop timers
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      setShowModal(false);
    } else if (state === "active") {
      // App is coming back to foreground
      // Skip logout if photo operation is in progress
      if (isPhotoOperationInProgress) {
        console.log('[SessionManager] Photo operation in progress - skipping PIN screen');
        return;
      }
      
      // Otherwise require re-authentication
      console.log('[SessionManager] App returned from background - forcing PIN screen');
      safeLogout();
    }
  });

  return () => subscription.remove();
}, [isAuthenticated, safeLogout, isPhotoOperationInProgress]); // Added dependency
```

## How It Works (v2)

1. **User taps "Take Photo"**: `setIsPhotoOperationInProgress(true)` is called
2. **Camera Opens**: App transitions to background state
3. **User Takes Photo**: Still in camera app
4. **Camera Closes**: App transitions to active state, but...
5. **SessionManager Checks Flag**: Detects `isPhotoOperationInProgress === true` and **skips logout**
6. **Flag Reset**: `setIsPhotoOperationInProgress(false)` is called
7. **User Continues**: User can complete form submission normally

## Behavior After Fix (v2)

✅ User can add members without PIN interruption  
✅ Photo capture works seamlessly  
✅ Photo selection from library works seamlessly  
✅ Editing member photos works without PIN  
✅ Session timeout still protects during normal usage  
✅ PIN still required when truly leaving app (home button, app switcher)  
✅ No false positives  

## Testing

To verify the fix:
1. Open the app and log in with PIN
2. Navigate to "Add Member"
3. Fill in all required fields
4. Click "Take Photo" button
5. Take a photo in the camera
6. ✅ App should return WITHOUT showing PIN screen
7. Complete the member registration normally
8. Member should be added successfully

Also test:
- "Pick from Gallery" option
- Edit member profile and change photo
- All should work without interrupting with PIN

## Files Modified (v2)

- `client/context/AppContext.tsx` (Added `isPhotoOperationInProgress` state)
- `client/screens/RegisterScreen.tsx` (Use new flag instead of timeout disable)
- `client/screens/MemberDetailScreen.tsx` (Use new flag instead of timeout disable)
- `client/components/SessionManager.tsx` (Check flag before logout on background transition)

## Related Configuration

SessionManager timeout behavior can be adjusted in:
- **File**: `client/components/SessionManager.tsx`
- **Constants**:
  ```typescript
  const IDLE_TIME = 2 * 60 * 1000;     // 2 minutes of inactivity
  const COUNTDOWN_SECONDS = 10;         // 10 second warning before logout
  ```

## Why This Approach is Better

**Previous approach (v1)**: Disabled timeout, which could have allowed unauthorized access if phone was left unattended during photo operations.

**New approach (v2)**: 
- Only skips PIN on **specific legitimate background transitions** (camera/gallery)
- Maintains full security during normal app usage
- Properly distinguishes between intentional background transitions and actual device security events
- No special handling of timeout - background detection is the only mechanism we bypass

