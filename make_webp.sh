# Command to create a Webp from a screen recording.

ffmpeg -i PM.mov -vf "fps=15,scale=480:-1:flags=lanczos" -loop 0 siggys-picks.webp

# ffmpeg -i PM.mov -vf "fps=15,scale=640:-1:flags=lanczos" -c:v libwebp -lossless 3 -qscale 50 -loop 0 siggys-picks.webp
