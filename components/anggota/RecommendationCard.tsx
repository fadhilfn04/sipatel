import { Users, Link2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

interface RecommendationCardProps {
  suggestion: RelationshipSuggestion;
  onAccept?: (suggestion: RelationshipSuggestion) => void;
  onReject?: (suggestion: RelationshipSuggestion) => void;
}

export function RecommendationCard({ suggestion, onAccept, onReject }: RecommendationCardProps) {
  const getRelationshipLabel = (type: string) => {
    const labels = {
      spouse: 'Pasangan',
      child: 'Anak',
      parent: 'Orang Tua',
      sibling: 'Saudara Kandung',
      other: 'Kerabat Lain',
    };
    return labels[type as keyof typeof labels] || 'Kerabat';
  };

  const getRelationshipVariant = (type: string): 'success' | 'warning' | 'secondary' => {
    const variants = {
      spouse: 'success' as const,
      child: 'success' as const,
      parent: 'success' as const,
      sibling: 'warning' as const,
      other: 'secondary' as const,
    };
    return variants[type as keyof typeof variants] || 'secondary';
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.7) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.7) return 'Tinggi';
    if (score >= 0.5) return 'Sedang';
    return 'Rendah';
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Member Info */}
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-medium">{suggestion.suggested_member.nama_anggota}</span>
            <Badge variant={getRelationshipVariant(suggestion.relationship_type)} appearance="ghost" className="text-xs">
              {getRelationshipLabel(suggestion.relationship_type)}
            </Badge>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">NIK:</span>
              <span className="ml-1 font-mono">{suggestion.suggested_member.nik}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Usia:</span>
              <span className="ml-1">{calculateAge(suggestion.suggested_member.tanggal_lahir)} tahun</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Alamat:</span>
              <span className="ml-1">{suggestion.suggested_member.alamat || '-'}</span>
            </div>
          </div>

          {/* Confidence Score */}
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-1 text-sm font-medium ${getConfidenceColor(suggestion.confidence_score)}`}>
                    <AlertCircle className="h-3 w-3" />
                    <span>Keyakinan: {Math.round(suggestion.confidence_score * 100)}%</span>
                    <span className="text-xs text-muted-foreground">({getConfidenceLabel(suggestion.confidence_score)})</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Score kepercayaan berdasarkan kemiripan data</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Matching Fields */}
          {suggestion.matching_fields.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {suggestion.matching_fields.map(field => (
                <Badge key={field} variant="secondary" appearance="ghost" className="text-xs">
                  <Link2 className="h-3 w-3 mr-1" />
                  {field}
                </Badge>
              ))}
            </div>
          )}

          {/* Reasons */}
          {suggestion.reasons.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Alasan:</p>
              <ul className="text-xs space-y-1">
                {suggestion.reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-primary">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {onAccept && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAccept(suggestion)}
              className="flex items-center gap-1"
            >
              <CheckCircle className="h-3 w-3" />
              Terima
            </Button>
          )}
          {onReject && (
            <Button
              size="sm"
              variant="dim"
              onClick={() => onReject(suggestion)}
              className="flex items-center gap-1"
            >
              <XCircle className="h-3 w-3" />
              Tolak
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
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