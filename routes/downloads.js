const express = require("express");
const { exec } = require("child_process");
const router = express.Router();

router.post("/", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  // Run yt-dlp command
  exec(`yt-dlp -f best -o "%(title)s.%(ext)s" "${url}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).json({ error: "Download failed" });
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }

    console.log(`stdout: ${stdout}`);
    res.json({ success: true, message: "Download complete", output: stdout });
  });
});

module.exports = router;
