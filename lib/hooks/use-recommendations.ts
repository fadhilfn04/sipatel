import { useQuery } from '@tanstack/react-query';

interface RelationshipSuggestion {
  suggested_member: {
    id: string;
    nik: string;
    nama_anggota: string;
    jenis_kelamin: string;
    tanggal_lahir: string;
    nama_cabang: string;
    alamat: string;
  };
  relationship_type: 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
  confidence_score: number;
  matching_fields: string[];
  reasons: string[];
}

interface RecommendationsResponse {
  target_member: {
    id: string;
    nik: string;
    nama_anggota: string;
    nama_cabang: string;
  };
  suggestions: RelationshipSuggestion[];
  total_suggestions: number;
}

interface ApiError {
  error: string;
  details?: string;
}

export function useRecommendations(anggotaId: string) {
  return useQuery({
    queryKey: ['recommendations', anggotaId],
    queryFn: async () => {
      const response = await fetch(`/api/anggota/${anggotaId}/recommendations`);
      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || 'Failed to fetch recommendations');
      }
      return response.json() as Promise<RecommendationsResponse>;
    },
    enabled: !!anggotaId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}