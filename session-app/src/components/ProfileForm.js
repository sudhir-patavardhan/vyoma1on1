import React, { useState, useEffect } from "react";
import AWS from "aws-sdk";
import "../styles.css";

// Configure AWS S3
const S3_BUCKET = "your-s3-bucket-name";
const REGION = "us-east-1";

// Initialize S3 client with IAM credentials (ensure IAM policy allows PutObject)
AWS.config.update({
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID, // Use environment variables for security
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  region: REGION,
});

const s3 = new AWS.S3();

const ProfileForm = ({ saveUserProfile, profile }) => {
  const [role, setRole] = useState(profile?.role || "");
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

  useEffect(() => {
    if (profile) {
      setRole(profile.role || "");
      setFormData({ ...formData, photo_url: profile.photo_url || "" });
      setPhotoPreview(profile.photo_url || "/default-profile.png");
    }
  }, [profile]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleArrayInputChange = (e, fieldName) => {
    const values = e.target.value.split(",").map((item) => item.trim());
    setFormData({ ...formData, [fieldName]: values });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = `${formData.name.replace(/ /g, "_")}_${Date.now()}.png`; // Unique filename for S3
    const params = {
      Bucket: S3_BUCKET,
      Key: `profile-photos/${fileName}`,
      Body: file,
      ACL: "public-read", // Set public access to image
      ContentType: file.type,
    };

    try {
      const uploadResponse = await s3.upload(params).promise();
      const imageUrl = uploadResponse.Location;
      setFormData({ ...formData, photo_url: imageUrl });
      setPhotoPreview(imageUrl);
      console.log("Photo uploaded successfully:", imageUrl);
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo. Please try again.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    saveUserProfile({ role, ...formData });
  };

  return (
    <div className="profile-form">
      <form onSubmit={handleSubmit}>
        <h2>Complete Your Profile</h2>

        {/* Profile Photo Section with S3 Upload */}
        <div className="profile-photo-section">
          <img
            src={photoPreview}
            alt="Profile Preview"
            className="profile-photo"
          />
          <input type="file" accept="image/*" onChange={handlePhotoUpload} />
        </div>

        <label>Role</label>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        >
          <option value="">Select Role</option>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
        </select>

        {/* Student Fields */}
        {role === "student" && (
          <>
            <input
              type="text"
              name="name"
              value={formData.name}
              placeholder="Full Name"
              onChange={handleInputChange}
              required
            />
            <input
              type="number"
              name="year_of_birth"
              value={formData.year_of_birth}
              placeholder="Year of Birth"
              onChange={handleInputChange}
              required
            />
            <input
              type="text"
              name="educational_qualification"
              value={formData.educational_qualification}
              placeholder="Educational Qualification"
              onChange={handleInputChange}
              required
            />
            <textarea
              name="why_1_1_classes"
              value={formData.why_1_1_classes}
              placeholder="Why do you want to get 1:1 classes?"
              onChange={handleInputChange}
            />
          </>
        )}

        {/* Teacher Fields */}
        {role === "teacher" && (
          <>
            <input
              type="text"
              name="name"
              value={formData.name}
              placeholder="Full Name"
              onChange={handleInputChange}
              required
            />
            <input
              type="number"
              name="year_of_birth"
              value={formData.year_of_birth}
              placeholder="Year of Birth"
              onChange={handleInputChange}
              required
            />
            <textarea
              name="bio"
              value={formData.bio}
              placeholder="Detailed Bio"
              onChange={handleInputChange}
              required
            />
            <input
              type="text"
              name="topics"
              value={formData.topics.join(", ")}
              placeholder="Topics for Teaching (comma-separated)"
              onChange={(e) => handleArrayInputChange(e, "topics")}
            />
            <input
              type="text"
              name="preferred_slots"
              value={formData.preferred_slots.join(", ")}
              placeholder="Preferred Teaching Slots (comma-separated)"
              onChange={(e) => handleArrayInputChange(e, "preferred_slots")}
            />
          </>
        )}

        <button type="submit">Save Profile</button>
      </form>
    </div>
  );
};

export default ProfileForm;
