# Nana Final Submission Checklist

## Assignment 1: Nana Requirements

Submit these two links:

```text
Frontend git URL: https://github.com/Oyewolesyl/NanaAppFRONTEND.git
Backend git URL: PASTE_BACKEND_GIT_URL_HERE
```

## Required Git Checks

Before deadline:

```bash
git status
git checkout main
git pull origin main
git checkout staging
git pull origin staging
git checkout develop
git pull origin develop
```

Make sure branches are synced:

```bash
git checkout main
git merge staging
git merge develop
git push origin main

git checkout staging
git merge main
git push origin staging

git checkout develop
git merge main
git push origin develop
```

## Frontend README Must Include

- Project info
- Setup instructions
- Staging URL
- Production URL

## Backend README Must Include

- API info
- Setup instructions
- Endpoints overview
- Database schema

## Product Requirements Checklist

### Frontend

- [ ] Clean HTML and CSS
- [ ] Responsive on different mobile devices
- [ ] Smart page setup
- [ ] No broken pages
- [ ] Production deployed

### Backend

- [ ] Database follows app design
- [ ] API follows best practices
- [ ] Deployed to online server
- [ ] Health route works

### Project Specific

- [ ] Add children
- [ ] Upload child image
- [ ] Edit children
- [ ] Delete children
- [ ] 3D person implemented with Three.js
- [ ] Body map limb recognition
- [ ] Rotate works
- [ ] Zoom works
- [ ] Pain index works
- [ ] Pain summary works
- [ ] Pain history works

## Final URLs

```text
Frontend production: https://nana-app-frontend.vercel.app
Frontend staging: https://nana-app-frontend-i28e.vercel.app
Backend production: https://nanaappbackend.onrender.com
```
