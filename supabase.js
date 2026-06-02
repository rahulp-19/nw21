/**
 * SweetXXorn - Supabase Integration Module (Live Version)
 * Handles live Supabase Auth, Database, and Storage operations exclusively.
 * Includes complete null-safety checks to prevent UI crashes if connection is offline.
 */

const supabaseConfig = {
  supabaseUrl: "https://sjxuviyiafcoxypgowwy.supabase.co",
  supabaseKey: "sb_publishable_lzjrbcgZEYdj1Z3XVzJpbQ_DVBP-HLh"
};

// Global interface exports
export let supabase = null;
export const isUsingMock = false;

// Import Supabase SDK dynamically
try {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  supabase = createClient(supabaseConfig.supabaseUrl, supabaseConfig.supabaseKey);
  console.log("Supabase Client initialized successfully!");
} catch (error) {
  console.error("Critical: Supabase SDK failed to load.", error);
}

// Config wrappers
export function saveSupabaseConfig(newConfig) {
  localStorage.setItem("sweetxxorn_supabase_config", JSON.stringify(newConfig));
  return true;
}

export function clearSupabaseConfig() {
  localStorage.removeItem("sweetxxorn_supabase_config");
}

// ----------------------------------------------------
// AUTHENTICATION INTERFACE
// ----------------------------------------------------

// Listen for Auth changes safely
export function subscribeToAuth(callback) {
  if (!supabase) {
    console.warn("Database connection offline. Auth listener skipped.");
    setTimeout(() => callback(null), 50);
    return () => {};
  }
  
  try {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const sbUser = session?.user;
      if (sbUser) {
        const userDoc = await getSupabaseUser(sbUser.id);
        const isUserAdmin = sbUser.email && sbUser.email.toLowerCase() === "musicophilepanda@gmail.com";
        if (userDoc) {
          if (isUserAdmin && userDoc.role !== "admin") {
            userDoc.role = "admin";
            await saveSupabaseUser(sbUser.id, userDoc);
          }
          callback({ uid: sbUser.id, email: sbUser.email, ...userDoc });
        } else {
          const newUser = {
            uid: sbUser.id,
            email: sbUser.email,
            displayName: isUserAdmin ? "NikRP" : (sbUser.user_metadata?.displayName || sbUser.email.split("@")[0]),
            role: isUserAdmin ? "admin" : "user",
            createdAt: new Date().toISOString(),
            subscription: isUserAdmin
              ? { planId: "sub_yearly", status: "active", expiresAt: "2030-12-31T23:59:59.000Z", gateway: "stripe" }
              : { planId: null, status: "none", expiresAt: null, gateway: null }
          };
          await saveSupabaseUser(sbUser.id, newUser);
          callback(newUser);
        }
      } else {
        callback(null);
      }
    });

    // Also immediately resolve the current session so callers get an initial state
    // and avoid transient redirects while the auth listener settles.
    try {
      supabase.auth.getSession().then(async ({ data }) => {
        const session = data?.session;
        const sbUser = session?.user;
        if (sbUser) {
          const userDoc = await getSupabaseUser(sbUser.id);
          const isUserAdmin = sbUser.email && sbUser.email.toLowerCase() === "musicophilepanda@gmail.com";
          if (userDoc) {
            if (isUserAdmin && userDoc.role !== "admin") {
              userDoc.role = "admin";
              await saveSupabaseUser(sbUser.id, userDoc);
            }
            callback({ uid: sbUser.id, email: sbUser.email, ...userDoc });
          } else {
            const newUser = {
              uid: sbUser.id,
              email: sbUser.email,
              displayName: isUserAdmin ? "NikRP" : (sbUser.user_metadata?.displayName || sbUser.email.split("@")[0]),
              role: isUserAdmin ? "admin" : "user",
              createdAt: new Date().toISOString(),
              subscription: isUserAdmin
                ? { planId: "sub_yearly", status: "active", expiresAt: "2030-12-31T23:59:59.000Z", gateway: "stripe" }
                : { planId: null, status: "none", expiresAt: null, gateway: null }
            };
            await saveSupabaseUser(sbUser.id, newUser);
            callback(newUser);
          }
        } else {
          callback(null);
        }
      }).catch(err => {
        console.warn('Failed to get initial supabase session:', err);
      });
    } catch (e) {
      console.warn('getSession not available or failed:', e);
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  } catch (err) {
    console.error("Auth listener failed:", err);
    setTimeout(() => callback(null), 50);
    return () => {};
  }
}

// Register User
export async function registerUser(email, password, displayName) {
  if (!supabase) throw new Error("Database connection offline.");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        displayName: displayName || email.split("@")[0]
      }
    }
  });
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error("Registration failed.");
  const isUserAdmin = email && email.toLowerCase() === "musicophilepanda@gmail.com";
  const profile = {
    uid: user.id,
    email: email,
    displayName: displayName || email.split("@")[0],
    role: isUserAdmin ? "admin" : "user",
    createdAt: new Date().toISOString(),
    subscription: isUserAdmin
      ? { planId: "sub_yearly", status: "active", expiresAt: "2030-12-31T23:59:59.000Z", gateway: "stripe" }
      : { planId: null, status: "none", expiresAt: null, gateway: null }
  };
  await saveSupabaseUser(user.id, profile);
  return profile;
}

// Login User
export async function loginUser(emailOrUsername, password) {
  if (!supabase) throw new Error("Database connection offline.");
  let targetEmail = emailOrUsername.trim();
  let isAdminCredential = false;

  if (targetEmail === "NikRP" || targetEmail.toLowerCase() === "musicophilepanda@gmail.com") {
    targetEmail = "musicophilepanda@gmail.com";
    isAdminCredential = true;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password
  });
  
  if (error) {
    if (isAdminCredential && password === "NikRP@19") {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: targetEmail,
        password,
        options: {
          data: { displayName: "NikRP" }
        }
      });
      if (!signUpError && signUpData.user) {
        const adminUser = {
          uid: signUpData.user.id,
          email: targetEmail,
          displayName: "NikRP",
          role: "admin",
          createdAt: new Date().toISOString(),
          subscription: { planId: "sub_yearly", status: "active", expiresAt: "2030-12-31T23:59:59.000Z", gateway: "stripe" }
        };
        await saveSupabaseUser(signUpData.user.id, adminUser);
        return adminUser;
      }
    }
    throw error;
  }

  const user = data.user;
  let profile = await getSupabaseUser(user.id);
  if (isAdminCredential) {
    if (!profile || profile.role !== "admin") {
      profile = {
        uid: user.id,
        email: targetEmail,
        displayName: "NikRP",
        role: "admin",
        createdAt: profile ? (profile.createdAt || new Date().toISOString()) : new Date().toISOString(),
        subscription: profile ? (profile.subscription || { planId: "sub_yearly", status: "active", expiresAt: "2030-12-31T23:59:59.000Z", gateway: "stripe" }) : { planId: "sub_yearly", status: "active", expiresAt: "2030-12-31T23:59:59.000Z", gateway: "stripe" }
      };
      await saveSupabaseUser(user.id, profile);
    }
  }
  return profile;
}

// Logout User
export async function logoutUser() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Reset Password
export async function sendPasswordReset(email) {
  if (!supabase) throw new Error("Database connection offline.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/login.html'
  });
  if (error) throw error;
}

// Change Admin Password
export async function changeAdminPassword(newPassword) {
  if (!supabase) throw new Error("Database connection offline.");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// DATABASE USER HELPERS
// ----------------------------------------------------
async function getSupabaseUser(uid) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error("Supabase user fetch error:", e);
    return null;
  }
}

async function saveSupabaseUser(uid, userData) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('users')
      .upsert({ uid, ...userData });
    if (error) throw error;
  } catch (e) {
    console.error("Supabase user save error:", e);
  }
}

// ----------------------------------------------------
// VIDEOS DATABASE CRUD
// ----------------------------------------------------
export async function fetchVideos() {
  if (!supabase) {
    console.warn("Database connection offline. Returning empty video catalog.");
    return [];
  }
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('uploadDate', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addVideo(videoData) {
  if (!supabase) throw new Error("Database connection offline.");
  const newVideo = {
    ...videoData,
    uploadDate: new Date().toISOString(),
    views: 0
  };
  const { data, error } = await supabase
    .from('videos')
    .insert([newVideo])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVideo(videoId, updatedFields) {
  if (!supabase) throw new Error("Database connection offline.");
  const { data, error } = await supabase
    .from('videos')
    .update(updatedFields)
    .eq('id', videoId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVideo(videoId) {
  if (!supabase) throw new Error("Database connection offline.");
  const { error } = await supabase
    .from('videos')
    .delete()
    .eq('id', videoId);
  if (error) throw error;
  return true;
}

export async function incrementVideoViews(videoId) {
  if (!supabase) return;
  try {
    const { data, error: selectError } = await supabase
      .from('videos')
      .select('views')
      .eq('id', videoId)
      .single();
    if (!selectError && data) {
      const currentViews = data.views || 0;
      await supabase
        .from('videos')
        .update({ views: currentViews + 1 })
        .eq('id', videoId);
    }
  } catch (e) {
    console.error("Failed to increment views:", e);
  }
}

// ----------------------------------------------------
// CATEGORIES DATABASE CRUD
// ----------------------------------------------------
export async function fetchCategories() {
  if (!supabase) {
    console.warn("Database connection offline. Returning empty category listing.");
    return [];
  }
  const { data, error } = await supabase
    .from('categories')
    .select('*');
  if (error) throw error;
  return data;
}

export async function addCategory(categoryName) {
  if (!supabase) throw new Error("Database connection offline.");
  const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const newCategory = { name: categoryName, slug };
  const { data, error } = await supabase
    .from('categories')
    .insert([newCategory])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(categoryId) {
  if (!supabase) throw new Error("Database connection offline.");
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId);
  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// SUBSCRIPTIONS / PLANS CONFIGURATION
// ----------------------------------------------------
export async function fetchPlans() {
  if (!supabase) {
    console.warn("Database connection offline. Returning empty plans list.");
    return [];
  }
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*');
  if (error) throw error;
  return data;
}

export async function updatePlan(planId, updatedFields) {
  if (!supabase) throw new Error("Database connection offline.");
  const { error } = await supabase
    .from('subscriptions')
    .update(updatedFields)
    .eq('id', planId);
  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// PAYMENT TRANSACTIONS LOGS
// ----------------------------------------------------
export async function fetchPayments() {
  if (!supabase) {
    console.warn("Database connection offline. Returning empty payments list.");
    return [];
  }
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('timestamp', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addPaymentRecord(paymentData) {
  if (!supabase) throw new Error("Database connection offline.");
  const transactionId = "TXN_" + Math.random().toString(36).substr(2, 9).toUpperCase();
  const record = {
    ...paymentData,
    timestamp: new Date().toISOString(),
    transactionId
  };

  const { error } = await supabase
    .from('payments')
    .insert([record]);
  if (error) throw error;

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + (paymentData.durationDays || 30));

  const subscriptionUpdate = {
    planId: paymentData.planId,
    status: "active",
    expiresAt: expiryDate.toISOString(),
    gateway: paymentData.gateway
  };

  await updateUserSubscriptionData(paymentData.userId, subscriptionUpdate);
  return record;
}

async function updateUserSubscriptionData(uid, subData) {
  if (!supabase) return;
  const { error } = await supabase
    .from('users')
    .update({ subscription: subData })
    .eq('uid', uid);
  if (error) throw error;
}

// ----------------------------------------------------
// USER ADMINISTRATION VIEWS & SETTINGS
// ----------------------------------------------------
export async function fetchUsers() {
  if (!supabase) {
    console.warn("Database connection offline. Returning empty users list.");
    return [];
  }
  const { data, error } = await supabase
    .from('users')
    .select('*');
  if (error) throw error;
  return data;
}

export async function updateUserRole(uid, newRole) {
  if (!supabase) throw new Error("Database connection offline.");
  const { error } = await supabase
    .from('users')
    .update({ role: newRole })
    .eq('uid', uid);
  if (error) throw error;
  return true;
}

export async function fetchSettings() {
  if (!supabase) {
    console.warn("Database connection offline. Returning empty settings.");
    return {};
  }
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'payment_settings')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateSettings(newSettings) {
  if (!supabase) throw new Error("Database connection offline.");
  const { error } = await supabase
    .from('settings')
    .upsert({ id: 'payment_settings', ...newSettings });
  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// ANNOUNCEMENT ACTIONS
// ----------------------------------------------------
export async function fetchAnnouncements() {
  if (!supabase) {
    console.warn("Database connection offline. Returning empty announcements list.");
    return [];
  }
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addAnnouncement(announcementData) {
  if (!supabase) throw new Error("Database connection offline.");
  const newAnn = {
    ...announcementData,
    createdAt: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('announcements')
    .insert([newAnn])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAnnouncement(id, updatedFields) {
  if (!supabase) throw new Error("Database connection offline.");
  const { error } = await supabase
    .from('announcements')
    .update(updatedFields)
    .eq('id', id);
  if (error) throw error;
  return true;
}

export async function deleteAnnouncement(id) {
  if (!supabase) throw new Error("Database connection offline.");
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

// ----------------------------------------------------
// FILE UPLOADER (SUPABASE STORAGE)
// ----------------------------------------------------
export function uploadFile(file, directory, onProgress) {
  return new Promise(async (resolve, reject) => {
    if (!supabase) {
      reject(new Error("Database connection offline. Cannot upload file."));
      return;
    }
    
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${directory}/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      if (onProgress) onProgress(100);
      resolve(publicUrl);
    } catch (e) {
      reject(e);
    }
  });
}
