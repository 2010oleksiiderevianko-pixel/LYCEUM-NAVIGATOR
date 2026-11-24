"""JARVIS backend for LYCEUM NAVIGATOR. API keys stay on the server."""
import os, json
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv
from openai import OpenAI

ROOT = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT, '.env'))
app = Flask(__name__, static_folder=ROOT, static_url_path='')

SYSTEM = '''Ти JARVIS — розумний українськомовний голосовий помічник вебзастосунку LYCEUM NAVIGATOR для Ліцею ім. А. Волошина.
Відповідай природно, доброзичливо, конкретно і українською. Ти можеш пояснювати загальні теми, допомагати з навчанням і керувати функціями навігатора.
Використовуй переданий каталог приміщень як єдине джерело назв та номерів. Ніколи не вигадуй кабінети, поверхи, адреси, маршрути або переходи. Схема демонстраційна, неофіційна; 4-й поверх А/Б повторює 3-й лише як припущення. Не радь використовувати її для евакуації.
Якщо користувач просить знайти кабінет або побудувати маршрут до конкретного наявного приміщення, можеш повернути дію route_to з точним значенням destination із каталогу. Якщо місце неоднозначне або відсутнє — постав уточнювальне запитання і не запускай дію.
Поверни ЛИШЕ коректний JSON такого формату: {"reply":"текст відповіді","action":null} або {"reply":"текст відповіді","action":{"type":"open_view","view":"nav|map|info|assistant|settings"}} або {"reply":"текст відповіді","action":{"type":"route_to","destination":"точна назва з каталогу"}} або {"reply":"текст відповіді","action":{"type":"search_room","query":"пошуковий запит"}}.
Дозволені лише ці типи дій. Не повертай markdown чи текст поза JSON. Не стверджуй, що дія виконана, якщо лише пропонуєш її.'''

@app.get('/')
def index():
    return send_from_directory(ROOT, 'index.html')

@app.get('/api/health')
def health():
    return jsonify({'ok': True, 'configured': bool(os.getenv('OPENAI_API_KEY')), 'assistant': 'JARVIS'})

@app.post('/api/assistant')
def assistant():
    if not os.getenv('OPENAI_API_KEY'):
        return jsonify({'error': 'Не налаштовано OPENAI_API_KEY. Створи .env за зразком .env.example.'}), 503
    data = request.get_json(silent=True) or {}
    message = str(data.get('message', '')).strip()
    if not message or len(message) > 2000:
        return jsonify({'error': 'Повідомлення порожнє або задовге (максимум 2000 символів).'}), 400
    history = data.get('history', [])
    catalog = data.get('catalog', [])
    safe_history = []
    if isinstance(history, list):
        for item in history[-12:]:
            if isinstance(item, dict) and item.get('role') in ('user', 'assistant'):
                safe_history.append({'role': item['role'], 'content': str(item.get('content', ''))[:2000]})
    catalog_text = json.dumps(catalog[:250] if isinstance(catalog, list) else [], ensure_ascii=False)
    client = OpenAI(api_key=os.environ['OPENAI_API_KEY'], base_url=os.getenv('OPENAI_BASE_URL') or None)
    try:
        response = client.chat.completions.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
            temperature=0.55,
            response_format={'type': 'json_object'},
            messages=[{'role': 'system', 'content': SYSTEM + '\n\nКАТАЛОГ ПРИМІЩЕНЬ (JSON): ' + catalog_text}] + safe_history + [{'role': 'user', 'content': message}],
            max_tokens=600,
        )
        raw = response.choices[0].message.content or '{}'
        result = json.loads(raw)
        reply = str(result.get('reply', 'Не вдалося сформувати відповідь.'))[:4000]
        action = result.get('action')
        if not isinstance(action, dict) or action.get('type') not in ('open_view', 'route_to', 'search_room'):
            action = None
        if action and action.get('type') == 'open_view' and action.get('view') not in ('nav','map','info','assistant','settings'):
            action = None
        if action and action.get('type') in ('route_to','search_room'):
            key = 'destination' if action['type'] == 'route_to' else 'query'
            val = str(action.get(key, ''))[:120]
            if not val: action = None
            else: action[key] = val
        return jsonify({'reply': reply, 'action': action})
    except Exception as exc:
        app.logger.exception('JARVIS request failed')
        return jsonify({'error': 'Помилка підключення до ШІ. Перевір API-ключ, модель та інтернет.', 'detail': str(exc)[:300]}), 502

if __name__ == '__main__':
    app.run(host=os.getenv('HOST', '127.0.0.1'), port=int(os.getenv('PORT', '5000')), debug=False)
