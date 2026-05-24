# 🔒 보안 가이드 — 동행복권 계정 정보 관리

이 프로젝트는 매주 동행복권 데이터를 자동 수집하기 위해 dhlottery 계정을 사용합니다.
계정 정보는 다음 원칙으로 **절대 노출되지 않게** 관리됩니다.

---

## 🛡️ 보안 원칙

### 1. 자격증명은 환경변수로만 (코드에 X)
스크립트는 항상 `process.env.DHLOTTERY_USER_ID` / `DHLOTTERY_USER_PASSWORD`에서 읽습니다.
하드코딩된 값은 **절대 없습니다**.

### 2. .env 파일은 git 차단
`.gitignore`에 등록되어 있어 `.env` 파일은 절대 git에 커밋되지 않습니다.

### 3. GitHub Secrets에 암호화 저장
프로덕션(GitHub Actions)에서는 **GitHub Secrets**를 사용. AES 암호화 저장.

### 4. 로그/콘솔 출력에 비밀번호 안 나옴
스크립트는 "RSA 암호화 중..." 같은 메시지만 출력. 실제 값은 절대 출력 X.

### 5. HTTPS + RSA 이중 암호화 전송
dhlottery에 전송 시:
- HTTPS로 통신 자체 암호화
- 추가로 비밀번호를 RSA 공개키로 암호화

---

## 🚨 절대 하지 말 것

- ❌ 비밀번호를 코드 파일에 직접 입력
- ❌ `.env` 파일을 git에 커밋 (또는 강제 푸시)
- ❌ 비밀번호를 채팅/이메일/스크린샷에 노출
- ❌ dhlottery 비밀번호를 다른 사이트와 동일하게 사용
- ❌ 비밀번호를 콘솔에 `console.log()`

---

## ✅ 권장 사항

### 가장 안전한 방법: **자동화 전용 부계정**

본 계정과 별도로 자동화용 계정을 만드세요:

1. https://dhlottery.co.kr 새 계정 가입
2. 본인 명의로 등록 (본인인증 필요)
3. **충전금 0원 유지** (혹시 모를 위험 차단)
4. 이 부계정 정보를 자동화에만 사용

#### 부계정 사용의 장점:
- 본 계정 비밀번호 노출 위험 0
- 만약 부계정이 털려도 충전금 0원이라 무피해
- 본 계정은 평소처럼 안전하게 사용

### 본 계정을 쓴다면 최소 다음을 지키세요:

1. **고유한 비밀번호** 설정 (다른 사이트와 다르게)
2. 정기적으로 비밀번호 변경 (3~6개월)
3. dhlottery 충전금을 큰 액수로 두지 말기

---

## 📋 로컬 테스트 (개발자용)

### Windows PowerShell:
```powershell
$env:DHLOTTERY_USER_ID="your_id"
$env:DHLOTTERY_USER_PASSWORD="your_password"
node scripts/fetch-dhlottery-auth.mjs --round=1225
```
PowerShell 창 닫으면 환경변수 사라짐 (영구 저장 X).

### Mac/Linux:
```bash
export DHLOTTERY_USER_ID=your_id
export DHLOTTERY_USER_PASSWORD=your_password
node scripts/fetch-dhlottery-auth.mjs --round=1225
```

### .env 파일 사용 (선택):
```
# .env (절대 git에 올리지 마세요)
DHLOTTERY_USER_ID=your_id
DHLOTTERY_USER_PASSWORD=your_password
```

```powershell
# .env 로드 후 실행 (dotenv 사용 시)
node --env-file=.env scripts/fetch-dhlottery-auth.mjs --round=1225
```

---

## 🤖 GitHub Actions 설정

### GitHub Secrets 등록 (단 한 번):
1. https://github.com/woghks4143-spec/lottofinde 접속
2. Settings → Secrets and variables → Actions
3. "New repository secret" 클릭
4. 다음 두 개 등록:
   - `DHLOTTERY_USER_ID` = 동행복권 ID
   - `DHLOTTERY_USER_PASSWORD` = 동행복권 비밀번호

### 워크플로에서 자동 사용:
```yaml
env:
  DHLOTTERY_USER_ID: ${{ secrets.DHLOTTERY_USER_ID }}
  DHLOTTERY_USER_PASSWORD: ${{ secrets.DHLOTTERY_USER_PASSWORD }}
```

GitHub Actions는 로그에 secret 값을 자동으로 `***`로 마스킹합니다.

---

## ⚠️ 만약 노출됐다면 (사고 대응)

비밀번호가 노출된 것 같으면 **즉시**:

1. **dhlottery에서 비밀번호 변경** (가장 우선)
2. GitHub Secrets 값 업데이트
3. (혹시 git 히스토리에 있다면) `git rm` + force push + 이전 커밋 rebase로 제거
4. 노출된 비밀번호로 다른 사이트 로그인 안 되는지 확인 (다른 사이트와 다른 비밀번호 사용 권장하는 이유)

---

## 🔐 보안 등급

| 위치 | 암호화 | 노출 위험 |
|---|---|---|
| 본인 PC 환경변수 (테스트) | OS 메모리 | 매우 낮음 |
| .env 파일 (로컬) | 없음 (평문) | 낮음 (.gitignore로 git 차단) |
| GitHub Secrets | AES 암호화 | 매우 낮음 |
| HTTPS 트래픽 | TLS 1.3 + RSA | 매우 낮음 |

**우리 구조는 업계 표준 보안 수준입니다.**
