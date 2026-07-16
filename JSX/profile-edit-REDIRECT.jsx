// src/app/profile/edit/page.jsx
//
// This page used to read/write a `profiles` table with a schema
// (user_type, valu_score, cover_url, hiring_focus, company_size…) that no
// longer exists — professional_profiles uses active_tracks, valu_index, and
// doesn't have most of those columns at all. Rather than patch a page built
// against a dead data model, /profile/setup (now fetch-and-prefills an
// existing row, so it works as both create and edit) is the single correct
// implementation. This route just forwards old links — including the
// "COMPLETE YOUR PROFILE" button in the post-assessment email — there.
import { redirect } from 'next/navigation'

export default function ProfileEditRedirect() {
  redirect('/profile/setup')
}
