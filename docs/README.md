# 로또핀더 법무 문서 — GitHub Pages

이 폴더는 GitHub Pages로 호스팅되는 정적 페이지입니다.
앱 내 `app/privacy-policy.tsx`, `app/terms-of-service.tsx`와 **동일한 내용**을 외부에 공개합니다.

## 📄 페이지 구성

```
docs/
├── index.html              ← 랜딩 페이지 (문서 목록)
├── privacy-policy.html     ← 개인정보처리방침
├── terms-of-service.html   ← 이용약관
├── style.css               ← 공통 스타일 (다크모드 자동 지원)
└── README.md               ← 이 파일
```

## 🔗 공개 URL (GitHub Pages 활성화 후)

- 인덱스: `https://woghks4143-spec.github.io/lottofinde/`
- 개인정보처리방침: `https://woghks4143-spec.github.io/lottofinde/privacy-policy.html`
- 이용약관: `https://woghks4143-spec.github.io/lottofinde/terms-of-service.html`

이 URL을 **Google Play Console**의 "개인정보처리방침" 필드에 등록하세요.

## 🔄 동기화 규칙 (중요)

앱 내 `app/privacy-policy.tsx` 또는 `app/terms-of-service.tsx`를 수정할 때는
**반드시** 이 폴더의 해당 HTML 파일도 동일하게 수정해야 합니다.

- 두 곳 내용이 다르면 약관 분쟁 시 위험
- 시행일(`EFFECTIVE_DATE`) 변경 시 양쪽 모두 갱신
- 버전(`VERSION`) 변경 시 양쪽 모두 갱신
