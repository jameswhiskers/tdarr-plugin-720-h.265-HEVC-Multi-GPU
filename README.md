# tdarr-plugin-720-h.265-HEVC-Multi-GPU
Transcodes all video to H.265 (HEVC), scaling to 720p with letterboxing. Automatically selects NVIDIA (CUDA/NVENC), AMD/Intel (VAAPI), or CPU (libx265). Preserves audio/subtitles and skips files already compliant.


# WARNING - There is no options, it will transcode everything thats not 720p H.265 into 720p H.265
# Also untested on Nvidia cards


You can go through and adjust some of the output settings and resolution. This was made for my usecase, to have everything consistent for a Tunarr systrem to reduce glitches/buffering. 

User Guide
Dump it in your tdarr/server/plugins/local folder
Set up a new library with Source/Output set
Add it to the transcode options
Scan
Pray
