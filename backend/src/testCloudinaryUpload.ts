import "dotenv/config";
import cloudinary from "./config/cloudinary";

async function testUpload() {
    try {
        const result = await cloudinary.uploader.upload(
            "C:\\Users\\admin\\Desktop\\jobs\\backend\\test.jpg",
            {
                upload_preset: "job_radar_resume_test",
                resource_type: "image",
            }
        );

        console.log("Upload successful:");
        console.log({
            public_id: result.public_id,
            secure_url: result.secure_url,
            resource_type: result.resource_type,
        });
    } catch (error: any) {
        console.error("Upload failed:", error);
        console.error(
            "Full error:",
            JSON.stringify(error, null, 2)
        );
    }
}

testUpload();