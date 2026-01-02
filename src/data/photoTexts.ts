/**
 * Photo Texts Configuration
 * 
 * Map of media file paths to their hover text captions.
 * The key should be the relative path from /src/assets/journey/
 * 
 * Example:
 *   "Young/Goa/20180419_115448.jpg": "Beautiful sunset at Goa beach"
 */

export const photoTexts: Record<string, string> = {
  // Goa memories
  "Young/Goa/20180419_115448.jpg": "Exploring the beautiful shores of Goa",
  "Young/Goa/20180419_115758.jpg": "Ocean waves and endless horizons",
  "Young/Goa/20180419_120431.jpg": "Sun, sand, and serenity",
  "Young/Goa/20180420_122454.jpg": "Making memories by the sea",
  
  // Rudraprayag journey
  "Young/Rudraprayag/IMG-20180513-WA0004.jpg": "The majestic mountains of Rudraprayag",
  "Young/Rudraprayag/IMG-20180513-WA0012.jpg": "Nature's beauty at its finest",
  
  // FRI memories
  "Young/clg/dun/FRI/IMG20171111141303.jpg": "A day at the Forest Research Institute",
  "Young/clg/dun/FRI/IMG20171111145402_1.jpg": "Colonial architecture and green gardens",
  
  // Nainital trip
  "Young/nainital/IMG20171231152750.jpg": "The enchanting Nainital lake",
  "Young/nainital/IMG20171231163025.jpg": "Mountain views and fresh air",
  "Young/nainital/IMG20180101101739.jpg": "New year in the hills",
  
  // Rishikesh adventure
  "Young/rishikesh/DSC_0031.JPG": "The holy Ganges at Rishikesh",
  "Young/rishikesh/DSC_0109.JPG": "Spiritual vibes and river rafting",
  
  // Job memories - Pune
  "Young/job/pune/IMG20190720195314.jpg": "Working life in Pune",
  "Young/job/pune/IMG20190720131915.jpg": "Weekend explorations",
  "Young/job/pune/marine drive.jpg": "Marine Drive vibes",
  
  // Farewell
  "Young/clg/farewell/IMG_20190608_192312.jpg": "Farewell memories with friends",
  
  // Add more captions here as needed...
};

/**
 * Get the caption text for a given media path
 * @param relativePath - The relative path from /src/assets/journey/
 * @returns The caption text or undefined if not found
 */
export function getPhotoText(relativePath: string): string | undefined {
  return photoTexts[relativePath];
}
