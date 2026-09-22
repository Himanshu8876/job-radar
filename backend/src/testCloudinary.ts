import "dotenv/config";
import { testCloudinary } from "./config/cloudinary";

testCloudinary()
    .then(() => {
        console.log("Cloudinary configuration is working.");
    })
    .catch((error) => {
        console.error("Cloudinary ping failed:", error);
    });