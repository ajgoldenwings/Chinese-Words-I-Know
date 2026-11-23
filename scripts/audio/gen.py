"""Generate natural + slow MP3s for every word with Amazon Polly (neural, Zhiyu, cmn-CN).
Output follows .kiro/specs/chinese-words-i-know/content/audio.md:
  44.1 kHz, 128 kbps mono MP3, 0.3 s silence before and after,
  assets/audio/words/<slug>/<slug>-natural.mp3 and <slug>-slow.mp3
Usage: python scripts/audio/gen.py [--ffmpeg PATH]   (needs boto3 and AWS credentials)
"""
import argparse, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
import boto3

ap = argparse.ArgumentParser()
ap.add_argument('--ffmpeg', default='ffmpeg')
args = ap.parse_args()
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
words = json.load(open(os.path.join(ROOT, 'src/shared/content/words.json')))['words']
from botocore.config import Config
polly = boto3.client('polly', region_name='us-east-1', config=Config(retries={'max_attempts': 10, 'mode': 'adaptive'}))
RATES = {'natural': '100%', 'slow': '60%'}
FILTER = ('silenceremove=start_periods=1:start_threshold=-50dB,areverse,'
          'silenceremove=start_periods=1:start_threshold=-50dB,areverse,'
          'adelay=300:all=1,apad=pad_dur=0.3')

def make(job):
    w, speed = job
    out = os.path.join(ROOT, 'assets/audio/words', w['id'], f"{w['id']}-{speed}.mp3")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    ssml = (f'<speak><lang xml:lang="cmn-CN"><prosody rate="{RATES[speed]}">{w["simplified"]}</prosody></lang></speak>')
    pcm = polly.synthesize_speech(Text=ssml, TextType='ssml', VoiceId='Zhiyu', Engine='neural',
                                  LanguageCode='cmn-CN', OutputFormat='pcm', SampleRate='16000')['AudioStream'].read()
    r = subprocess.run([args.ffmpeg, '-y', '-loglevel', 'error', '-f', 's16le', '-ar', '16000', '-ac', '1', '-i', '-',
                        '-af', FILTER, '-ar', '44100', '-ac', '1', '-b:a', '128k', out],
                       input=pcm, capture_output=True)
    if r.returncode: print('FAIL', w['id'], speed, r.stderr.decode()); return False
    return True

jobs = [(w, s) for w in words for s in ('natural', 'slow')]
with ThreadPoolExecutor(2) as ex:
    ok = list(ex.map(make, jobs))
print(sum(ok), 'ok of', len(jobs))
sys.exit(0 if all(ok) else 1)
