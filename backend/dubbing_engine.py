import os
import whisper
from google import genai
from gtts import gTTS
from moviepy.editor import VideoFileClip, AudioFileClip

# 1. រៀបចំ Gemini API ជំនាន់ថ្មី
# កុំភ្លេចដូរពាក្យខាងក្រោម ទៅជា API Key របស់អ្នក
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def download_video(youtube_url):
    print("១. កំពុងទាញយកវីដេអូ...")
    # ទាញយកជាទម្រង់ mp4 ដើម្បីកុំឱ្យ Error ពេលកាត់ត
    os.system(f'python -m yt_dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]" -o "input_video.mp4" "{youtube_url}"')
    
    print("កំពុងបំបែកយកសំឡេង...")
    os.system('ffmpeg -y -i input_video.mp4 -q:a 0 -map a input_audio.mp3')
    
    return "input_video.mp4", "input_audio.mp3"

def transcribe_audio(audio_file):
    print("២. កំពុងស្តាប់ និងស្រង់អត្ថបទ (Whisper AI)... អាចចំណាយពេលបន្តិច")
    whisper_model = whisper.load_model("tiny") 
    result = whisper_model.transcribe(audio_file)
    return result["text"]

def translate_to_khmer(english_text):
    print("៣. កំពុងបកប្រែជាភាសាខ្មែរ (Gemini)...")
    prompt = f"Translate the following English text to natural-sounding Khmer. Only return the translated text without any explanation or extra symbols:\n\n{english_text}"
    
    try:
        # សាកល្បងប្រើម៉ូដែលជំនាន់ចុងក្រោយ
        response = client.models.generate_content(
            model='gemini-2.5-flash', # ប្តូរឈ្មោះម៉ូដែលនៅទីនេះ
            contents=prompt,
        )
        return response.text
    except Exception as e:
        print(f"⚠️ មានបញ្ហាជាមួយ gemini-2.5-flash: {e}")
        print("🔄 កំពុងប្តូរទៅប្រើ gemini-pro ជំនួសវិញ...")
        try:
            # ប្រើ Fallback model ប្រសិនបើម៉ូដែលទី 1 មិនដំណើរការ
            response = client.models.generate_content(
                model='gemini-pro',
                contents=prompt,
            )
            return response.text
        except Exception as e2:
             print(f"❌ បរាជ័យទាំងស្រុងក្នុងការបកប្រែ: {e2}")
             return "សូមអភ័យទោស ការបកប្រែមានបញ្ហា។"

def text_to_speech_khmer(khmer_text):
    print("៤. កំពុងបង្កើតសំឡេងខ្មែរ (TTS)...")
    tts = gTTS(khmer_text, lang='km')
    tts.save("khmer_audio.mp3")
    return "khmer_audio.mp3"

def merge_video_and_audio(video_file, new_audio_file):
    print("៥. កំពុងផ្គុំវីដេអូ និងសំឡេងខ្មែរបញ្ចូលគ្នា...")
    video = VideoFileClip(video_file)
    video_without_audio = video.without_audio()
    
    new_audio = AudioFileClip(new_audio_file)
    final_video = video_without_audio.set_audio(new_audio)
    
    final_video.write_videofile("final_dubbed_video.mp4", codec="libx264", audio_codec="aac")
    
    video.close()
    new_audio.close()
    final_video.close()
    
    print("✅ ដំណើរការរួចរាល់! វីដេអូថ្មីរបស់អ្នកគឺ: final_dubbed_video.mp4")

# ================= ផ្នែកដំណើរការ =================
if __name__ == "__main__":
    # លុបចន្លោះទទេ (spaces) នៅសងខាង Link ដើម្បីការពារការ Error
    url = input("សូមបញ្ចូល YouTube URL: ").strip()
    
    vid_file, aud_file = download_video(url)
    
    if os.path.exists(vid_file) and os.path.exists(aud_file):
        en_text = transcribe_audio(aud_file)
        print("\nអត្ថបទដើមអង់គ្លេស៖", en_text[:100], "...\n")
        
        km_text = translate_to_khmer(en_text)
        print("អត្ថបទខ្មែរ៖", km_text[:100], "...\n")
        
        new_aud = text_to_speech_khmer(km_text)
        merge_video_and_audio(vid_file, new_aud)
    else:
        print("❌ ការទាញយកវីដេអូបានបរាជ័យ។")