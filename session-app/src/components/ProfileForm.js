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
} from "react-icons/fa";
import { API_BASE_URL } from "../config";
import "../styles.css";

const ProfileForm = ({ saveUserProfile, profile }) => {
  const [role, setRole] = useState(profile?.role || "");

  // For the tag-style inputs
  const [newTopic, setNewTopic] = useState("");
  const [newSlot, setNewSlot] = useState("");

  const [formData, setFormData] = useState({
    name: profile?.name || "",
    year_of_birth: profile?.year_of_birth || "",
    educational_qualification: profile?.educational_qualification || "",
    learning_interests: Array.isArray(profile?.learning_interests)
      ? profile?.learning_interests
      : [],
    location: profile?.location || "",
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
      setRole(profile.role || "");
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
      const uploadResponse = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}`
        );
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

    try {
      await saveUserProfile({ role, ...formData });
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

          <div className="role-selector">
            <button
              type="button"
              className={`role-btn ${role === "student" ? "active" : ""}`}
              onClick={() => setRole("student")}
            >
              <FaUser className="role-icon" />
              <span>Student</span>
            </button>
            <button
              type="button"
              className={`role-btn ${role === "teacher" ? "active" : ""}`}
              onClick={() => setRole("teacher")}
            >
              <FaGraduationCap className="role-icon" />
              <span>Teacher</span>
            </button>
          </div>
        </div>

        {(role === "student" || role === "teacher") && (
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

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="year_of_birth">Year of Birth</label>
                <input
                  id="year_of_birth"
                  type="number"
                  name="year_of_birth"
                  value={formData.year_of_birth}
                  onChange={handleInputChange}
                  min="1900"
                  max={new Date().getFullYear()}
                  required
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  id="location"
                  type="text"
                  name="location"
                  value={formData.location}
                  placeholder="City, Country"
                  onChange={handleInputChange}
                  className="form-control"
                />
              </div>
            </div>

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
        {role === "student" && (
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
        {role === "teacher" && (
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

        {saveError && (
          <div className="error-message alert alert-danger">{saveError}</div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            disabled={isSaving || !role}
            className={`btn btn-primary ${
              isSaving || !role ? "btn-disabled" : ""
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
