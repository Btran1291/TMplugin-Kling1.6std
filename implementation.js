async function generate_video_from_image_with_fal_ai(params, userSettings) {
  const { image_url, prompt } = params;
  const { fal_ai_api_key, duration = "5", aspect_ratio = "16:9" } = userSettings;
  const endpoint = "https://queue.fal.run/fal-ai/kling-video/v1.6/standard/image-to-video";
  const requestBody = { image_url, prompt, duration, aspect_ratio };
  try {
    const submitResponse = await fetch(endpoint, { method: "POST", headers: { "Authorization": `Key ${fal_ai_api_key}`, "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      throw new Error(`Fal.ai API request failed: Status: ${submitResponse.status}, StatusText: ${submitResponse.statusText}, Body: ${errorBody}`);
    }
    const { request_id } = await submitResponse.json();
    if (!request_id) throw new Error("Did not receive a request_id from Fal.ai API.");
    let result = null;
    const maxAttempts = 25;
    const pollInterval = 60000;
    let startTime = Date.now();
    for (let attempts = 0; attempts < maxAttempts && !result; attempts++) {
      const statusResponse = await fetch(`https://queue.fal.run/fal-ai/kling-video/requests/${request_id}/status`, { headers: { "Authorization": `Key ${fal_ai_api_key}` } });
      if (!statusResponse.ok) {
        const errorBody = await statusResponse.text();
        throw new Error(`Fal.ai status check failed: Status: ${statusResponse.status}, StatusText: ${statusResponse.statusText}, Body: ${errorBody}`);
      }
      const statusJson = await statusResponse.json();
      if (statusJson.status === "COMPLETED") {
        const resultResponse = await fetch(`https://queue.fal.run/fal-ai/kling-video/requests/${request_id}`, { headers: { "Authorization": `Key ${fal_ai_api_key}` } });
        if (!resultResponse.ok) {
          const errorBody = await resultResponse.text();
          throw new Error(`Fal.ai result fetch failed: Status: ${resultResponse.status}, StatusText: ${resultResponse.statusText}, Body: ${errorBody}`);
        }
        result = await resultResponse.json();
        break;
      } else if (statusJson.status === "FAILED") {
        throw new Error(`Fal.ai request failed: ${statusJson.error}`);
      }
      if (!result) await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
    if (!result) {
      let elapsedTimeMinutes = Math.round((Date.now() - startTime) / 60000);
      throw new Error(`Fal.ai request timed out after ${maxAttempts} attempts (approximately ${elapsedTimeMinutes} minutes).`);
    }
    const [widthRatio, heightRatio] = aspect_ratio.split(':').map(Number);
    const aspectRatioValue = heightRatio / widthRatio;
    return result.video?.url ? `<!DOCTYPE html><html><head><title>Generated Video</title><style>body {margin: 0;display: flex;justify-content: center;align-items: center;min-height: 100vh;background-color: #f0f2f5;}.video-wrapper {position: relative;width: 100%;max-width: 100%;padding-bottom: ${aspectRatioValue * 100}%;}video {position: absolute;top: 0;left: 0;width: 100%;height: 100%;display: block;}</style></head><body><div class="video-wrapper"><video controls><source src="${result.video.url}" type="video/mp4">Your browser does not support the video tag.</video></div></body></html>` : "No video was generated.";
  } catch (error) {
    return `**Error:** ${error.message}`;
  }
}
