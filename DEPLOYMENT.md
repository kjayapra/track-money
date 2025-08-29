# 100% Free Hosting Setup with Vercel + Supabase

This guide will help you deploy your Track Money application completely free using Vercel for hosting and Supabase for the PostgreSQL database.

## Prerequisites

1. A GitHub account
2. A Vercel account (free tier)
3. A Supabase account (free tier)

## Step 1: Setup Supabase Database

1. Go to [Supabase](https://supabase.com/) and create a free account
2. Create a new project
3. Wait for the database to be ready
4. Go to Settings > Database
5. Copy the connection string from "Connection string" section
6. Note down these values:
   - Database URL (connection string)
   - Project URL
   - API Keys (anon/public key and service_role/secret key)

## Step 2: Push Code to GitHub

```bash
# Initialize git repository if not already done
git init
git add .
git commit -m "Initial commit for deployment"

# Create GitHub repository and push
git remote add origin https://github.com/YOUR_USERNAME/track-money.git
git push -u origin main
```

## Step 3: Deploy to Vercel

1. Go to [Vercel](https://vercel.com/) and sign in with GitHub
2. Click "New Project"
3. Import your `track-money` repository
4. Configure the project:
   - Framework Preset: Other
   - Root Directory: `.` (leave blank)
   - Build Command: `npm run build`
   - Output Directory: `src/client/dist`
   - Install Command: `npm install`

## Step 4: Set Environment Variables in Vercel

In your Vercel project dashboard:

1. Go to Settings > Environment Variables
2. Add these variables:

```
NODE_ENV=production
DATABASE_URL=your_supabase_connection_string_here
```

Example DATABASE_URL format:
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

## Step 5: Build and Deploy

1. The initial deployment should start automatically
2. If it fails, check the build logs
3. Your application will be available at: `https://your-project-name.vercel.app`

## Step 6: Test the Application

1. Visit your deployed URL
2. Try uploading a CSV file to test the database connection
3. Check if transactions are being stored properly

## Free Tier Limits

### Vercel Free Tier:
- 100GB bandwidth per month
- 100 deployments per day
- Serverless functions: 12 second max duration
- Perfect for personal/family use

### Supabase Free Tier:
- Up to 500MB database storage
- Up to 2GB bandwidth per month
- Up to 50,000 monthly active users
- Plenty for family expense tracking

## Troubleshooting

### Database Connection Issues
- Verify the DATABASE_URL is correct
- Check Supabase project is active
- Ensure Supabase allows connections from 0.0.0.0/0

### Build Issues
- Check that all dependencies are in package.json
- Verify build command works locally: `npm run build`
- Check Vercel build logs for specific errors

### File Upload Issues
- Vercel serverless functions have temporary file storage
- Files are automatically cleaned up after processing
- Large files (>10MB) may timeout

## Monitoring

1. **Vercel Analytics**: Monitor website performance
2. **Supabase Dashboard**: Monitor database usage and performance
3. Set up email alerts for usage limits

## Future Enhancements

Once deployed, you can add:
1. Monthly email reminders (using Vercel cron jobs + SendGrid free tier)
2. Analytics summaries (using the existing analytics endpoints)
3. Custom domain (free with Vercel)

## Cost Optimization

To stay within free limits:
- Optimize images and assets
- Use efficient database queries
- Monitor usage through Vercel and Supabase dashboards
- Set up usage alerts

Your Track Money application is now 100% free to host and maintain!