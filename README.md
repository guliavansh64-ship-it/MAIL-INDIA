# Mail India - Frontend Web Client

Enterprise Transactional & Bulk Email Platform for India.

## Deployment Instructions

### AIC Hosting / Static Hosting
1. Upload all contents of this repository to your static web hosting directory.
2. Ensure `index.html` is located at the root of your domain.
3. Open `common.js` and set your backend Vercel API URL at the top:
   ```javascript
   window.MAILINDIA_API_BASE = 'https://your-backend.vercel.app';
   ```
4. All dashboard views, API management, and authentication flows will automatically communicate with your Vercel backend.
