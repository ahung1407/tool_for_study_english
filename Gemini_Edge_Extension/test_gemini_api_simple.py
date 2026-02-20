import requests
import json
import sys

def test_gemini_api(api_key):
    print(f"--- Testing API Key: {api_key[:10]}... ---")
    
    # 1. List Models
    print("\n[1] Checking available models...")
    list_models_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    
    try:
        response = requests.get(list_models_url)
        if response.status_code == 200:
            models = response.json().get('models', [])
            print(f"Found {len(models)} models.")
            available_models = []
            for m in models:
                if 'generateContent' in m.get('supportedGenerationMethods', []):
                    model_name = m['name'].split('/')[-1]
                    print(f"  - {model_name}")
                    available_models.append(model_name)
        else:
            print(f"Error listing models: {response.status_code} - {response.text}")
            return
    except Exception as e:
        print(f"Connection error: {e}")
        return

    # 2. Test Generation
    print("\n[2] Testing generation with common models...")
    test_models = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro', 'gemini-1.0-pro']
    
    # Also test valid models found in list
    for m in available_models:
        if m not in test_models:
            test_models.append(m)

    # Filter to only unique and likely chat models
    test_models = [m for m in test_models if 'gemini' in m and 'vision' not in m]
    # Limit to first 5 to save time/quota if list is long
    test_models = test_models[:5]

    for model_name in test_models:
        print(f"\n  > Testing model: {model_name}...", end=" ")
        generate_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": "Hello, explain what you are in one sentence."}]}]
        }
        
        try:
            gen_response = requests.post(generate_url, headers={'Content-Type': 'application/json'}, json=payload)
            if gen_response.status_code == 200:
                print("SUCCESS! ✅")
                # print(gen_response.json())
            else:
                print(f"FAILED ❌ ({gen_response.status_code})")
                # print(gen_response.text)
        except Exception as e:
            print(f"ERROR: {e}")

if __name__ == "__main__":
    key = input("Enter your Gemini API Key: ").strip()
    test_gemini_api(key)
