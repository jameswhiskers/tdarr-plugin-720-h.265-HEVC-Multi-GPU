// Tdarr Plugin: TrashPanda 720 Multi-GPU
// Author: James + GPT-5
// Description: Transcodes all video to H.265 (HEVC), scaling to 720p with letterboxing if required.
//              Automatically selects NVIDIA (CUDA/NVENC), AMD/Intel (VAAPI), or CPU (libx265).
//              Preserves audio/subtitles and skips files already compliant.
// -----------------------------------------------------------------------------
//      WARNING: THIS IS A BLUNDERBUSS PLUGIN  
// Point it at a library and it *will* do things — permanently.
// There are no safety prompts, no configuration menus, no mercy.
// results may vary. You have been warned.
// -----------------------------------------------------------------------------


const fs = require('fs');
const details = () => ({
    id: "Tdarr_Letter_Box_720_Multi-GPU",
    Name: 'Letter Box 720 Multi-GPU',
    Type: 'Video',
    Operation: 'Transcode',
    Description:
    'Convert all video to H.265 (HEVC), max 720p, using NVENC, VAAPI, or CPU automatically.',
    Version: '1.1',
    Tags: 'ffmpeg,h265,gpu,nvenc,vaapi,scale720'
});

const plugin = (file) => {
    const response = {
        processFile: false,
        preset: '',
        preset2: '',
        container: '.mkv',
        FFmpegMode: true,
        handBrakeMode: false,
        reQueueAfter: false,
        infoLog: '',
    };

    if (file.fileMedium !== 'video') {
        response.infoLog = 'Not a video file.';
        return response;
    }

    // ---- Detect GPU Type -----------------------------------------------------
    const hasVAAPI = fs.existsSync('/dev/dri/renderD128');
    const hasNvidia = fs.existsSync('/dev/nvidiactl') || fs.existsSync('/dev/nvidia0');

    let mode = 'cpu';
    if (hasNvidia) mode = 'nvidia';
    else if (hasVAAPI) mode = 'vaapi';

    response.infoLog += `Detected hardware: ${mode.toUpperCase()}\n`;
    const vidStream = file.ffProbeData.streams.find(s => s.codec_type === 'video');
    const width  = vidStream?.width  || 0;
    const height = vidStream?.height || 0;
    // ---- Skip already-compliant files -----------------------------------------
    if (file.video_codec_name?.toLowerCase() === 'hevc') {
        // Skip only if fully compliant
        if (width <= 1280 && height <= 720) {
            response.infoLog += `Already HEVC and ≤720p (${width}x${height}). Skipping.\n`;
            return response;
        }
        // Otherwise fall through and rescale / re-encode
        response.infoLog += `HEVC detected but ${width}x${height} > 720p → rescaling.\n`;
    }

    response.infoLog += `Scaling ${width}x${height} → 1280x720.\n`

    
    // Create a codec-to-decoder lookup map
    // If any decoders where missed... add them here
    const decoderMap = {
      h263: 'h263',
      h264: 'h264',
      hevc: 'hevc',
      mjpeg: 'mjpeg',
      mpeg1: 'mpeg1video',
      mpeg2: 'mpeg2video',
      mpeg4: 'mpeg4',
      msmpeg4v3: 'msmpeg4v3',
      vc1: 'vc1',
      vp8: 'vp8',
      vp9: 'vp9',
    };
    
    // Find the right decoder or default
    const codec = file.video_codec_name?.toLowerCase() || 'unknown';
    const decoder = decoderMap[codec] || 'mpeg4';
    // ---- Build input (preset) -----------------------------------------------
    if (mode === 'nvidia') {
        response.preset =
        //Theres a good chance it will break here, i dont have an nvidia to test with
        `-hwaccel cuda -hwaccel_output_format cuda -vsync 0 -c:v ${decoder}_cuvid`;
    } else if (mode === 'vaapi') {
        response.preset =
        `-hwaccel vaapi -hwaccel_device /dev/dri/renderD128 -hwaccel_output_format vaapi -vsync 0 -c:v ${decoder}`;
    } else {
        response.preset = `-vsync 0 -c:v ${decoder}`;
    }

    // ---- Choose filter chain -------------------------------------------------
    // This is where the scaling happens and padding happens
    let vfFilter = '';

    if (mode === 'nvidia') {
        vfFilter =
        'scale_npp=w=1280:h=720:force_original_aspect_ratio=decrease,' +
        'hwdownload,format=nv12,pad=1280:720:-1:-1:color=black,hwupload_cuda';
    } else if (mode === 'vaapi') {
        vfFilter =
        'scale_vaapi=w=1280:h=720:force_original_aspect_ratio=decrease,' +
        'hwdownload,format=nv12,pad=1280:720:-1:-1:color=black,hwupload,format=vaapi';
    } else {
        vfFilter =
        'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:-1:-1:color=black';
    }

    // ---- Building the output ------------------------------------------------
    if (mode === 'nvidia') {
        response.preset +=
        `<io> -map 0:v -map 0:a? -map 0:s? -c:a copy -c:s copy ` +
        `-vf "${vfFilter}" -c:v hevc_nvenc -preset fast -rc:v constqp -qp 25 -profile:v main10`;
    } else if (mode === 'vaapi') {
        response.preset +=
        `<io>-map 0:v -map 0:a? -map 0:s? -c:a copy -c:s copy ` +
        `-vf "${vfFilter}" ` +
        `-c:v hevc_vaapi -qp 25 -preset fast -profile:v main -rc_mode CQP`;
    } else {
        response.preset +=
        `<io> -map 0:v -map 0:a? -map 0:s? -c:a copy -c:s copy ` +
        `-vf "${vfFilter}" -c:v libx265 -crf 23 -preset medium -profile:v main10`;
    }

  response.processFile = true;
  response.infoLog += `Transcoding with ${mode.toUpperCase()} encoder.\n`;

  // Clean up accidental undefineds
  for (const key of Object.keys(response)) {
    if (typeof response[key] === 'string')
      response[key] = response[key].replace(/\bundefined\b/g, '').trim();
  }

  return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
