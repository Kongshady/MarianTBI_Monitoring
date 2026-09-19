import { useEffect, useRef, useState } from "react";
import { auth, db, storage } from "../../config/marian-config.js";
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import AppShell from "../layout/AppShell.jsx";
import PageHeader from "../ui/PageHeader.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import Avatar from "../ui/Avatar.jsx";
import SecuritySection from "./SecuritySection.jsx";
import { toast } from "../../lib/toast.js";
import { ErrorState, PageSkeleton } from "../ui/states.jsx";
import { pickSelfEditableProfile } from "../../lib/domain.js";

const EMPTY_FORM = {
  name: "",
  lastname: "",
  mobile: "",
  bio: "",
};

function snapshotOf(data) {
  return {
    name: data.name || "",
    lastname: data.lastname || "",
    mobile: data.mobile || "",
    bio: data.bio || "",
  };
}

function Profile() {
  const [userData, setUserData] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedSnapshot, setSavedSnapshot] = useState(EMPTY_FORM);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPath, setPhotoPath] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [formMessage, setFormMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const fileRef = useRef(null);

  const role = userData?.role || "";
  const dirty =
    !!userData && (JSON.stringify(form) !== JSON.stringify(savedSnapshot) || photoUrl !== (userData.profileImageUrl || ""));

  useEffect(() => {
    document.title = "My Profile";
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoadError("You are not signed in.");
          setLoading(false);
          return;
        }
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          setLoadError("User record not found.");
          setLoading(false);
          return;
        }
        const data = userDoc.data();
        setUserData({ id: userDoc.id, ...data });
        const snap = snapshotOf(data);
        setForm(snap);
        setSavedSnapshot(snap);
        setPhotoUrl(data.profileImageUrl || "");
        setPhotoPath(data.profileImagePath || "");
        setLoading(false);
      } catch (error) {
        console.error("Error loading profile:", error);
        setLoadError("We couldn't load your profile. Please try again.");
        setLoading(false);
      }
    };
    load();
  }, []);

  // Warn on tab close/refresh with unsaved changes. (In-app navigation
  // cannot be intercepted: the app uses a plain BrowserRouter, under which
  // React Router's useBlocker invariant-fails and blanks the page.)
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = (key) => (e) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setFormMessage(null);
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "First name is required.";
    if (!form.lastname.trim()) next.lastname = "Last name is required.";
    if (form.mobile.trim() && !/^[+\d][\d\s-]{6,14}$/.test(form.mobile.trim())) {
      next.mobile = "Enter a valid mobile number.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormMessage(null);
    if (!validate()) {
      setFormMessage({ tone: "error", text: "Please correct the highlighted fields." });
      return;
    }
    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("You are not signed in.");
      const payload = pickSelfEditableProfile({
        ...form,
        name: form.name.trim(),
        lastname: form.lastname.trim(),
        mobile: form.mobile.trim(),
        bio: form.bio.trim(),
      });
      await updateDoc(doc(db, "users", user.uid), payload);
      const snap = snapshotOf({ ...userData, ...payload });
      setSavedSnapshot(snap);
      setUserData((p) => ({ ...p, ...payload }));
      toast("Profile saved.");
    } catch (error) {
      console.error("Error updating profile:", error);
      setFormMessage({ tone: "error", text: "Could not save your profile. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormMessage({ tone: "error", text: "Choose an image file for your photo." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFormMessage({ tone: "error", text: "Photo must be smaller than 2 MB." });
      return;
    }
    setPhotoBusy(true);
    setFormMessage(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("You are not signed in.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `profileImages/${user.uid}/${Date.now()}_${safeName}`;
      await uploadBytes(ref(storage, path), file);
      const url = await getDownloadURL(ref(storage, path));
      if (photoPath) {
        try {
          await deleteObject(ref(storage, photoPath));
        } catch (cleanupError) {
          console.error("Error removing previous photo:", cleanupError);
        }
      }
      await updateDoc(doc(db, "users", user.uid), { profileImageUrl: url, profileImagePath: path });
      setPhotoUrl(url);
      setPhotoPath(path);
      setUserData((p) => ({ ...p, profileImageUrl: url, profileImagePath: path }));
      toast("Profile photo updated.");
    } catch (error) {
      console.error("Error uploading photo:", error);
      setFormMessage({ tone: "error", text: "Could not upload the photo. Please try again." });
    } finally {
      setPhotoBusy(false);
    }
  };

  const handlePhotoRemove = async () => {
    setPhotoBusy(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("You are not signed in.");
      if (photoPath) {
        try {
          await deleteObject(ref(storage, photoPath));
        } catch (cleanupError) {
          console.error("Error removing photo file:", cleanupError);
        }
      }
      await updateDoc(doc(db, "users", user.uid), {
        profileImageUrl: deleteField(),
        profileImagePath: deleteField(),
      });
      setPhotoUrl("");
      setPhotoPath("");
      setUserData((p) => ({ ...p, profileImageUrl: "", profileImagePath: "" }));
      toast("Profile photo removed.");
    } catch (error) {
      console.error("Error removing photo:", error);
      setFormMessage({ tone: "error", text: "Could not remove the photo. Please try again." });
    } finally {
      setPhotoBusy(false);
    }
  };

  const displayName = `${form.name || userData?.name || ""} ${form.lastname || userData?.lastname || ""}`.trim() || "User";

  return (
    <AppShell role={role} userName={displayName}>
      <PageHeader
        title="My profile"
        description="Personal information visible across the program. Role and account controls live elsewhere."
        actions={dirty ? <StatusBadge status="Unsaved changes" tone="amber" /> : null}
      />

      {loading ? (
        <PageSkeleton rows={6} />
      ) : loadError || !userData ? (
        <ErrorState message={loadError || "Profile unavailable."} onRetry={() => window.location.reload()} />
      ) : (
        <div className="max-w-4xl">
          {/* Identity header */}
          <section aria-label="Identity" className="bg-white border border-line rounded p-5 sm:p-6 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="flex items-center gap-4">
                {photoUrl ? (
                  <img src={photoUrl} alt={`${displayName}'s profile photo`} className="w-20 h-20 rounded-full object-cover border border-line" />
                ) : (
                  <Avatar name={displayName} size="lg" className="!w-20 !h-20 !text-xl" />
                )}
                <div className="flex flex-col gap-1.5 items-start">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    aria-label="Upload profile photo"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={photoBusy}
                    className="px-3 py-1.5 bg-white border border-line rounded text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
                  >
                    {photoBusy ? "Working..." : photoUrl ? "Change photo" : "Upload photo"}
                  </button>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={handlePhotoRemove}
                      disabled={photoBusy}
                      className="px-3 py-1 text-[13px] text-red-600 hover:underline disabled:opacity-60"
                    >
                      Remove
                    </button>
                  )}
                  <p className="text-[11px] text-muted">JPG, PNG, or GIF up to 2 MB.</p>
                </div>
              </div>
              <div className="sm:ml-2 min-w-0">
                <h2 className="text-xl font-semibold text-slate-900 truncate">{displayName}</h2>
                <p className="text-sm text-muted truncate">{userData.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <StatusBadge status={userData.role || "—"} tone="blue" />
                </div>
              </div>
            </div>
          </section>

          <form onSubmit={handleSave}>
            {formMessage && (
              <div
                role={formMessage.tone === "error" ? "alert" : "status"}
                className={`mb-4 p-3.5 rounded border text-sm ${
                  formMessage.tone === "error"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-green-200 bg-green-50 text-green-800"
                }`}
              >
                {formMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <section aria-label="Personal information" className="bg-white border border-line rounded p-5 sm:p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-1">Personal information</h2>
                <p className="text-[13px] text-muted mb-4">How you appear to the program.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="tbi-label" htmlFor="pf-first">
                      First name <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="pf-first"
                      type="text"
                      autoComplete="given-name"
                      value={form.name}
                      onChange={set("name")}
                      className={`tbi-input h-12 text-[15px] ${errors.name ? "border-red-400" : ""}`}
                      aria-invalid={!!errors.name}
                    />
                    {errors.name && <p className="text-[13px] text-red-600 mt-1" role="alert">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="tbi-label" htmlFor="pf-last">
                      Last name <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="pf-last"
                      type="text"
                      autoComplete="family-name"
                      value={form.lastname}
                      onChange={set("lastname")}
                      className={`tbi-input h-12 text-[15px] ${errors.lastname ? "border-red-400" : ""}`}
                      aria-invalid={!!errors.lastname}
                    />
                    {errors.lastname && <p className="text-[13px] text-red-600 mt-1" role="alert">{errors.lastname}</p>}
                  </div>
                </div>
                <div className="mt-3">
                  <label className="tbi-label" htmlFor="pf-mobile">Mobile number</label>
                  <input
                    id="pf-mobile"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={form.mobile}
                    onChange={set("mobile")}
                    placeholder="09xx xxx xxxx"
                    className={`tbi-input h-12 text-[15px] ${errors.mobile ? "border-red-400" : ""}`}
                    aria-invalid={!!errors.mobile}
                  />
                  {errors.mobile && <p className="text-[13px] text-red-600 mt-1" role="alert">{errors.mobile}</p>}
                </div>
                <div className="mt-3">
                  <label className="tbi-label" htmlFor="pf-email">Email (managed separately)</label>
                  <input
                    id="pf-email"
                    type="email"
                    value={userData.email || ""}
                    readOnly
                    tabIndex={-1}
                    aria-readonly="true"
                    className="tbi-input h-12 text-[15px] text-slate-400 bg-slate-50"
                  />
                  <p className="text-xs text-muted mt-1">Change it anytime in Security &amp; account below.</p>
                </div>
              </section>

              <div className="flex flex-col gap-5">
                <section aria-label="About" className="bg-white border border-line rounded p-5 sm:p-6">
                  <h2 className="text-sm font-semibold text-slate-900 mb-1">About me</h2>
                  <p className="text-[13px] text-muted mb-4">A short introduction shown on your startup teams.</p>
                  <label className="tbi-label" htmlFor="pf-bio">Bio</label>
                  <textarea
                    id="pf-bio"
                    value={form.bio}
                    onChange={set("bio")}
                    rows="4"
                    maxLength={500}
                    placeholder="Tell us briefly about yourself and your venture."
                    className="tbi-input"
                  />
                </section>
              </div>
            </div>

            <div className="sticky bottom-0 mt-5 bg-surface/95 backdrop-blur border-t border-line py-3 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={() => {
                  setForm(savedSnapshot);
                  setErrors({});
                  setFormMessage(null);
                }}
                className="px-4 py-2.5 bg-white border border-line text-slate-700 rounded text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={!dirty || saving}
                className="px-6 py-2.5 bg-primary-color text-white rounded text-sm font-semibold hover:bg-primary-deep transition disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>

          <SecuritySection userData={userData} />
        </div>
      )}
    </AppShell>
  );
}

export default Profile;
