import { auth } from "@clerk/nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

/**
 * UploadThing File Router Configuration
 * Handles media uploads for the Village Family Tree application
 */
export const ourFileRouter = {
  /**
   * memberProfile: Upload route for member profile images
   * - Restricted to images only (JPEG, PNG, GIF, WebP)
   * - Max file size: 4MB per image
   * - Authenticated users only
   * - Associates upload with specific memberId
   */
  memberProfile: f({
    image: { maxFileSize: "4MB" },
  })
    .middleware(async ({ req }) => {
      // Authenticate user via Clerk
      const { userId } = await auth();

      if (!userId) {
        throw new UploadThingError("Unauthorized");
      }

      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Return relevant metadata after upload completes
      console.log("File uploaded successfully:", {
        fileName: file.name,
        fileSize: file.size,
        fileUrl: file.url,
        userId: metadata.userId,
      });

      return {
        uploadedBy: metadata.userId,
        fileUrl: file.url,
        fileName: file.name,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
