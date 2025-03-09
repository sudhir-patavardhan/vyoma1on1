import React, { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import {
  FaUpload,
  FaUser,
  FaGraduationCap,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaBook,
  FaPlus,
  FaTimes,
  FaLock,
} from "react-icons/fa";
import { API_BASE_URL } from "../config";
import "../styles.css";

const ProfileForm = ({ saveUserProfile, profile }) => {
  // For backward compatibility with existing profiles
  const [roles, setRoles] = useState(
    profile?.roles || (profile?.role ? [profile.role] : [])
  );
  
  // For users switching between roles in the app
  const [activeRole, setActiveRole] = useState(
    profile?.role || (profile?.roles?.[0] || "")
  );

  // For the tag-style inputs
  const [newTopic, setNewTopic] = useState("");
  const [newSlot, setNewSlot] = useState("");

  const [formData, setFormData] = useState({
    name: profile?.name || "",
    educational_qualification: profile?.educational_qualification || "",
    learning_interests: Array.isArray(profile?.learning_interests)
      ? profile?.learning_interests
      : [],
    timezone: profile?.timezone || "IST",
    why_1_1_classes: profile?.why_1_1_classes || "",
    qualification: profile?.qualification || "",
    bio: profile?.bio || "",
    associations: profile?.associations || "",
    years_of_experience: profile?.years_of_experience || "",
    topics: Array.isArray(profile?.topics) ? profile?.topics : [],
    preferred_slots: Array.isArray(profile?.preferred_slots)
      ? profile?.preferred_slots
      : [],
    testimonials: Array.isArray(profile?.testimonials)
      ? profile?.testimonials
      : [],
    photo_url: profile?.photo_url || "",
  });

  const [photoPreview, setPhotoPreview] = useState(
    profile?.photo_url || "/default-profile.png"
  );

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (profile) {
      // Handle both new 'roles' array and legacy 'role' string
      const profileRoles = profile.roles || (profile.role ? [profile.role] : []);
      setRoles(profileRoles);
      setActiveRole(profile.role || (profileRoles[0] || ""));
      
      setFormData({
        ...profile,
        learning_interests: Array.isArray(profile.learning_interests)
          ? profile.learning_interests
          : [],
        topics: Array.isArray(profile.topics) ? profile.topics : [],
        preferred_slots: Array.isArray(profile.preferred_slots)
          ? profile.preferred_slots
          : [],
        testimonials: Array.isArray(profile.testimonials)
          ? profile.testimonials
          : [],
        photo_url: profile.photo_url || "",
      });
      setPhotoPreview(profile.photo_url || "/default-profile.png");
    }
  }, [profile]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Add a topic tag
  const addTopic = () => {
    if (newTopic.trim() !== "") {
      setFormData({
        ...formData,
        topics: [...formData.topics, newTopic.trim()],
      });
      setNewTopic("");
    }
  };

  // Remove a topic tag
  const removeTopic = (index) => {
    const updatedTopics = [...formData.topics];
    updatedTopics.splice(index, 1);
    setFormData({
      ...formData,
      topics: updatedTopics,
    });
  };

  // Add a time slot
  const addTimeSlot = () => {
    if (newSlot.trim() !== "") {
      setFormData({
        ...formData,
        preferred_slots: [...formData.preferred_slots, newSlot.trim()],
      });
      setNewSlot("");
    }
  };

  // Remove a time slot
  const removeTimeSlot = (index) => {
    const updatedSlots = [...formData.preferred_slots];
    updatedSlots.splice(index, 1);
    setFormData({
      ...formData,
      preferred_slots: updatedSlots,
    });
  };

  // Handle pressing Enter key in tag inputs
  const handleKeyDown = (e, addFunction) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addFunction();
    }
  };

  const auth = useAuth();

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);

    try {
      // Validate file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Photo must be less than 5MB");
      }

      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/gif"];
      if (!validTypes.includes(file.type)) {
        throw new Error("Photo must be JPEG, PNG or GIF format");
      }

      const fileName = `${
        formData.name.replace(/ /g, "_") || "user"
      }_${Date.now()}.${file.name.split(".").pop()}`; // Unique filename for S3

      // Step 1: Request a pre-signed URL from our backend
      console.log("Requesting pre-signed URL...");
      const presignedUrlResponse = await fetch(
        `${API_BASE_URL}/presigned-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.user.access_token}`,
          },
          body: JSON.stringify({
            file_type: file.type,
            file_name: fileName,
          }),
        }
      );

      if (!presignedUrlResponse.ok) {
        const errorText = await presignedUrlResponse.text();
        console.error("Error response from presigned URL endpoint:", errorText);
        throw new Error("Failed to get upload URL. Please try again.");
      }

      const { upload_url, public_url } = await presignedUrlResponse.json();
      console.log("Received pre-signed URL:", upload_url);

      // Step 2: Upload the file directly to S3 using the pre-signed URL
      console.log("Uploading file to S3...");
      try {
        // Add more detailed logging
        console.log("Upload URL:", upload_url);
        console.log("File type:", file.type);
        console.log("File size:", file.size);
        
        const uploadResponse = await fetch(upload_url, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => '');
          console.error("S3 upload error response:", errorText);
          throw new Error(
            `Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}${errorText ? ` - ${errorText}` : ''}`
          );
        }
        
        console.log("S3 upload response status:", uploadResponse.status);
      } catch (uploadError) {
        console.error("Error during file upload:", uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log("Upload successful");

      // Step 3: Update the form with the public URL
      setFormData({ ...formData, photo_url: public_url });
      setPhotoPreview(public_url);
      console.log("Photo uploaded successfully:", public_url);
    } catch (error) {
      console.error("Error uploading photo:", error);
      setSaveError(
        error.message || "Failed to upload photo. Please try again."
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    // Validate that at least one role is selected
    if (roles.length === 0) {
      setSaveError("Please select at least one role (Student, Teacher, or Admin)");
      setIsSaving(false);
      return;
    }

    try {
      // Create a new profile object with the updated fields
      const profileToSave = { 
        ...formData,
        roles: roles,
        role: activeRole || roles[0] // Set the primary role as the active role or the first role
      };
      
      await saveUserProfile(profileToSave);
    } catch (error) {
      console.error("Error in profile form:", error);
      setSaveError(
        error.message || "Failed to save profile. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-form-container">
      <form onSubmit={handleSubmit} className="profile-form">
        <h2 className="form-title">Complete Your Profile</h2>
        <p className="form-subtitle">
          Fill in your details to get started with Sessions Red
        </p>

        {/* Profile Photo Section with S3 Upload */}
        <div className="profile-photo-section">
          <div className="photo-container">
            <img
              src={photoPreview}
              alt="Profile Preview"
              className="profile-photo"
            />
            <label className="photo-upload-btn">
              <FaUpload className="upload-icon" />
              <span>{uploadingPhoto ? "Uploading..." : "Change Photo"}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="hidden-input"
              />
            </label>
          </div>
        </div>

        <div className="form-section">
          <h3 className="section-title">Account Type</h3>
          <p className="section-subtitle">Select all roles that apply to you</p>

          <div className="role-selector">
            <button
              type="button"
              className={`role-btn ${roles.includes("student") ? "active" : ""}`}
              onClick={() => {
                // Toggle student role
                if (roles.includes("student")) {
                  setRoles(roles.filter(r => r !== "student"));
                } else {
                  setRoles([...roles, "student"]);
                }
                
                // Set active role if it's the only role or if no active role is set
                if (!activeRole || roles.length === 0) {
                  setActiveRole("student");
                }
              }}
            >
              <FaUser className="role-icon" />
              <span>Student</span>
            </button>
            <button
              type="button"
              className={`role-btn ${roles.includes("teacher") ? "active" : ""}`}
              onClick={() => {
                // Toggle teacher role
                if (roles.includes("teacher")) {
                  setRoles(roles.filter(r => r !== "teacher"));
                } else {
                  setRoles([...roles, "teacher"]);
                }
                
                // Set active role if it's the only role or if no active role is set
                if (!activeRole || roles.length === 0) {
                  setActiveRole("teacher");
                }
              }}
            >
              <FaGraduationCap className="role-icon" />
              <span>Teacher</span>
            </button>
            <button
              type="button"
              className={`role-btn ${roles.includes("admin") ? "active" : ""}`}
              onClick={() => {
                // Toggle admin role
                if (roles.includes("admin")) {
                  setRoles(roles.filter(r => r !== "admin"));
                } else {
                  setRoles([...roles, "admin"]);
                }
                
                // Set active role if it's the only role or if no active role is set
                if (!activeRole || roles.length === 0) {
                  setActiveRole("admin");
                }
              }}
            >
              <FaLock className="role-icon" />
              <span>Admin</span>
            </button>
          </div>
          
          {/* Display active role selector if multiple roles are selected */}
          {roles.length > 1 && (
            <div className="active-role-selector">
              <label htmlFor="active-role">Primary Role:</label>
              <select 
                id="active-role" 
                value={activeRole} 
                onChange={(e) => setActiveRole(e.target.value)}
                className="form-control"
              >
                {roles.map(role => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
              <p className="form-text">This will be your default view when logging in.</p>
            </div>
          )}
        </div>

        {roles.length > 0 && (
          <div className="form-section">
            <h3 className="section-title">Basic Information</h3>

            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="form-control"
              />
            </div>

{/* Year of birth and location fields removed as they're captured in Cognito */}

            <div className="form-group">
              <label htmlFor="timezone">Timezone</label>
              <select
                id="timezone"
                name="timezone"
                value={formData.timezone}
                onChange={handleInputChange}
                className="form-control"
              >
                <option value="IST">Indian Standard Time (IST)</option>
                <option value="UTC">Coordinated Universal Time (UTC)</option>
                <option value="EST">Eastern Standard Time (EST)</option>
                <option value="CST">Central Standard Time (CST)</option>
                <option value="PST">Pacific Standard Time (PST)</option>
                <option value="GMT">Greenwich Mean Time (GMT)</option>
                <option value="CET">Central European Time (CET)</option>
                <option value="JST">Japan Standard Time (JST)</option>
              </select>
            </div>
          </div>
        )}

        {/* Student Fields */}
        {roles.includes("student") && (
          <div className="form-section">
            <h3 className="section-title">Student Information</h3>

            <div className="form-group">
              <label htmlFor="educational_qualification">
                Educational Qualification
              </label>
              <input
                id="educational_qualification"
                type="text"
                name="educational_qualification"
                value={formData.educational_qualification}
                onChange={handleInputChange}
                required
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label htmlFor="why_1_1_classes">
                Why do you want to get 1:1 classes?
              </label>
              <textarea
                id="why_1_1_classes"
                name="why_1_1_classes"
                value={formData.why_1_1_classes}
                onChange={handleInputChange}
                className="form-control"
                rows="4"
              />
            </div>

            <div className="form-group">
              <label>Learning Interests</label>
              <div className="tags-input-container">
                <div className="tags-list">
                  {formData.learning_interests.map((interest, index) => (
                    <div key={index} className="tag">
                      <span>{interest}</span>
                      <button
                        type="button"
                        className="tag-remove"
                        onClick={() => {
                          const updated = [...formData.learning_interests];
                          updated.splice(index, 1);
                          setFormData({
                            ...formData,
                            learning_interests: updated,
                          });
                        }}
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="tags-input">
                  <input
                    type="text"
                    placeholder="Add an interest and press Enter"
                    value={formData.newInterest || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, newInterest: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (formData.newInterest?.trim()) {
                          setFormData({
                            ...formData,
                            learning_interests: [
                              ...formData.learning_interests,
                              formData.newInterest.trim(),
                            ],
                            newInterest: "",
                          });
                        }
                      }
                    }}
                    className="form-control"
                  />
                  <button
                    type="button"
                    className="tag-add-btn"
                    onClick={() => {
                      if (formData.newInterest?.trim()) {
                        setFormData({
                          ...formData,
                          learning_interests: [
                            ...formData.learning_interests,
                            formData.newInterest.trim(),
                          ],
                          newInterest: "",
                        });
                      }
                    }}
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Teacher Fields */}
        {roles.includes("teacher") && (
          <div className="form-section">
            <h3 className="section-title">Teacher Information</h3>

            <div className="form-group">
              <label htmlFor="bio">Professional Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                required
                className="form-control"
                rows="4"
                placeholder="Tell students about your background, teaching style, and expertise..."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="qualification">Qualifications</label>
                <input
                  id="qualification"
                  type="text"
                  name="qualification"
                  value={formData.qualification}
                  placeholder="Degrees, Certificates, etc."
                  onChange={handleInputChange}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="years_of_experience">Years of Experience</label>
                <input
                  id="years_of_experience"
                  type="number"
                  name="years_of_experience"
                  value={formData.years_of_experience}
                  onChange={handleInputChange}
                  min="0"
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Teaching Topics</label>
              <div className="tags-input-container">
                <div className="tags-list">
                  {formData.topics.map((topic, index) => (
                    <div key={index} className="tag">
                      <span>{topic}</span>
                      <button
                        type="button"
                        className="tag-remove"
                        onClick={() => removeTopic(index)}
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="tags-input">
                  <input
                    type="text"
                    placeholder="Add a topic and press Enter"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, addTopic)}
                    className="form-control"
                  />
                  <button
                    type="button"
                    className="tag-add-btn"
                    onClick={addTopic}
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>
              <small className="form-text">
                Add topics you can teach (e.g., "Mathematics", "Python
                Programming")
              </small>
            </div>

            <div className="form-group">
              <label>Preferred Teaching Slots</label>
              <div className="tags-input-container">
                <div className="tags-list">
                  {formData.preferred_slots.map((slot, index) => (
                    <div key={index} className="tag">
                      <span>{slot}</span>
                      <button
                        type="button"
                        className="tag-remove"
                        onClick={() => removeTimeSlot(index)}
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="tags-input">
                  <input
                    type="text"
                    placeholder="Add a time slot and press Enter"
                    value={newSlot}
                    onChange={(e) => setNewSlot(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, addTimeSlot)}
                    className="form-control"
                  />
                  <button
                    type="button"
                    className="tag-add-btn"
                    onClick={addTimeSlot}
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>
              <small className="form-text">
                Add your available time slots (e.g., "Mon 9-11 AM", "Tue 2-4
                PM")
              </small>
            </div>
          </div>
        )}
        
        {/* Admin Fields - This is minimal for now */}
        {roles.includes("admin") && (
          <div className="form-section">
            <h3 className="section-title">Admin Information</h3>
            <div className="form-group">
              <p>As an admin, you'll have access to the admin panel for managing system settings and viewing reports.</p>
            </div>
          </div>
        )}

        {saveError && (
          <div className="error-message alert alert-danger">{saveError}</div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            disabled={isSaving || roles.length === 0}
            className={`btn btn-primary ${
              isSaving || roles.length === 0 ? "btn-disabled" : ""
            }`}
          >
            {isSaving ? "Saving Profile..." : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileForm;
