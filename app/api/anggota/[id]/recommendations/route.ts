import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

interface RelationshipSuggestion {
  suggested_member: any;
  relationship_type: 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
  confidence_score: number;
  matching_fields: string[];
  reasons: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check permission
  const user = await requirePermission(PERMISSIONS.VIEW_KEANGGOTAAN);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;

    // Fetch the target member
    const { data: targetMember, error: memberError } = await supabase
      .from('anggota')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (memberError || !targetMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Fetch potential related members (same cabang, similar address, etc.)
    const { data: potentialMatches } = await supabase
      .from('anggota')
      .select('*')
      .neq('id', id) // Exclude the member themselves
      .is('deleted_at', null)
      .limit(100); // Get a reasonable sample

    if (!potentialMatches || potentialMatches.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // Calculate relationship suggestions
    const suggestions = potentialMatches
      .map(member => calculateRelationshipScore(targetMember, member))
      .filter(suggestion => suggestion.confidence_score > 0.3) // Only include suggestions with >30% confidence
      .sort((a, b) => b.confidence_score - a.confidence_score)
      .slice(0, 10); // Return top 10 suggestions

    return NextResponse.json({
      target_member: {
        id: targetMember.id,
        nik: targetMember.nik,
        nama_anggota: targetMember.nama_anggota,
        nama_cabang: targetMember.nama_cabang,
      },
      suggestions,
      total_suggestions: suggestions.length,
    });

  } catch (error: any) {
    console.error('Error in GET /api/anggota/[id]/recommendations:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

function calculateRelationshipScore(targetMember: any, potentialMatch: any): RelationshipSuggestion {
  let confidenceScore = 0;
  const matchingFields: string[] = [];
  const reasons: string[] = [];

  // Calculate age difference for relationship inference
  const targetAge = targetMember.tanggal_lahir
    ? calculateAge(targetMember.tanggal_lahir)
    : null;
  const matchAge = potentialMatch.tanggal_lahir
    ? calculateAge(potentialMatch.tanggal_lahir)
    : null;

  // Address similarity (strong indicator)
  const addressMatchScore = calculateAddressSimilarity(targetMember, potentialMatch);
  if (addressMatchScore > 0.5) {
    confidenceScore += addressMatchScore * 0.4;
    matchingFields.push('alamat');
    reasons.push('Alamat yang sama mirip');
  }

  // Phone number match (very strong indicator)
  if (targetMember.nomor_handphone && targetMember.nomor_handphone === potentialMatch.nomor_handphone) {
    confidenceScore += 0.3;
    matchingFields.push('nomor_handphone');
    reasons.push('Nomor handphone sama');
  }

  // Same branch (moderate indicator)
  if (targetMember.nama_cabang === potentialMatch.nama_cabang) {
    confidenceScore += 0.1;
    matchingFields.push('nama_cabang');
  }

  // Name similarity (weak indicator for family relationships)
  const nameSimilarity = calculateNameSimilarity(targetMember.nama_anggota, potentialMatch.nama_anggota);
  if (nameSimilarity > 0.5) {
    confidenceScore += nameSimilarity * 0.1;
    matchingFields.push('nama_anggota');
    reasons.push('Nama mirip (mungkin kerabat)');
  }

  // Determine relationship type based on age and other factors
  let relationshipType: 'spouse' | 'child' | 'parent' | 'sibling' | 'other' = 'other';

  if (targetAge && matchAge) {
    const ageDiff = Math.abs(targetAge - matchAge);

    // Spouse: Similar age + opposite gender + same address
    if (ageDiff < 15 &&
        targetMember.jenis_kelamin !== potentialMatch.jenis_kelamin &&
        addressMatchScore > 0.7) {
      relationshipType = 'spouse';
      confidenceScore += 0.2;
      reasons.push('Usia mirip, jenis kelamin berbeda, alamat sama');
    }
    // Parent/Child: Large age difference + same address
    else if (ageDiff > 20 && ageDiff < 50 && addressMatchScore > 0.6) {
      if (targetAge > matchAge) {
        relationshipType = 'child';
        reasons.push('Perbedaan usia besar, alamat sama');
      } else {
        relationshipType = 'parent';
        reasons.push('Perbedaan usia besar, alamat sama');
      }
    }
    // Sibling: Small age difference + same address
    else if (ageDiff < 10 && addressMatchScore > 0.7) {
      relationshipType = 'sibling';
      confidenceScore += 0.15;
      reasons.push('Usia mirip, alamat sama');
    }
  }

  return {
    suggested_member: {
      id: potentialMatch.id,
      nik: potentialMatch.nik,
      nama_anggota: potentialMatch.nama_anggota,
      jenis_kelamin: potentialMatch.jenis_kelamin,
      tanggal_lahir: potentialMatch.tanggal_lahir,
      nama_cabang: potentialMatch.nama_cabang,
      alamat: potentialMatch.alamat,
    },
    relationship_type: relationshipType,
    confidence_score: Math.min(confidenceScore, 1.0), // Cap at 1.0
    matching_fields: matchingFields,
    reasons: reasons,
  };
}

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

function calculateAddressSimilarity(member1: any, member2: any): number {
  let similarityScore = 0;
  let fieldsChecked = 0;

  // Check individual address fields
  if (member1.alamat && member2.alamat) {
    fieldsChecked++;
    if (member1.alamat === member2.alamat) similarityScore += 0.4;
  }

  if (member1.kelurahan && member2.kelurahan) {
    fieldsChecked++;
    if (member1.kelurahan === member2.kelurahan) similarityScore += 0.3;
  }

  if (member1.kecamatan && member2.kecamatan) {
    fieldsChecked++;
    if (member1.kecamatan === member2.kecamatan) similarityScore += 0.2;
  }

  if (member1.kota && member2.kota) {
    fieldsChecked++;
    if (member1.kota === member2.kota) similarityScore += 0.1;
  }

  return fieldsChecked > 0 ? similarityScore / fieldsChecked : 0;
}

function calculateNameSimilarity(name1: string, name2: string): number {
  // Simple name similarity based on last name
  const lastName1 = name1.split(' ').pop()?.toLowerCase() || '';
  const lastName2 = name2.split(' ').pop()?.toLowerCase() || '';

  if (lastName1 === lastName2 && lastName1.length > 2) {
    return 0.8;
  }

  return 0;
}