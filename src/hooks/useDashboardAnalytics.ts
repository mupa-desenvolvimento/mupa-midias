import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { useUserTenant } from './useUserTenant';

interface AudienceByHour {
  hour: string;
  people: number;
}

interface GenderDistribution {
  name: string;
  value: number;
  color: string;
}

interface AgeDistribution {
  range: string;
  count: number;
}

interface EmotionData {
  name: string;
  count: number;
  percentage: number;
}

interface ContentPerformance {
  contentId: string;
  contentName: string;
  views: number;
  avgAttention: number;
  topEmotion: string;
}

interface DashboardStats {
  devicesOnline: number;
  totalDevices: number;
  activeMedia: number;
  playlistCount: number;
  audienceToday: number;
  audienceYesterday: number;
  avgAttentionTime: number;
}

export const useDashboardAnalytics = () => {
  const [stats, setStats] = useState<DashboardStats>({
    devicesOnline: 0,
    totalDevices: 0,
    activeMedia: 0,
    playlistCount: 0,
    audienceToday: 0,
    audienceYesterday: 0,
    avgAttentionTime: 0
  });
  const [audienceByHour, setAudienceByHour] = useState<AudienceByHour[]>([]);
  const [genderDistribution, setGenderDistribution] = useState<GenderDistribution[]>([]);
  const [ageDistribution, setAgeDistribution] = useState<AgeDistribution[]>([]);
  const [emotionData, setEmotionData] = useState<EmotionData[]>([]);
  const [topContent, setTopContent] = useState<ContentPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { tenantId, companyId, isSuperAdmin } = useUserTenant();

  const fetchStats = useCallback(async () => {
    try {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();
      const yesterdayEnd = endOfDay(subDays(now, 1)).toISOString();

      // Build tenant-scoped queries
      let devicesQuery = supabase.from('devices').select('id, status, is_active');
      let mediaQuery = supabase.from('media_items').select('id').eq('status', 'active');
      let playlistsQuery = supabase.from('playlists').select('id').eq('is_active', true);

      if (!isSuperAdmin) {
        if (companyId) devicesQuery = devicesQuery.eq('company_id', companyId);
        if (tenantId) {
          mediaQuery = mediaQuery.eq('tenant_id', tenantId);
          playlistsQuery = playlistsQuery.eq('tenant_id', tenantId);
        }
      }

      const [
        devicesResult,
        mediaResult,
        playlistsResult,
        todayDetectionsResult,
        yesterdayDetectionsResult
      ] = await Promise.all([
        devicesQuery,
        mediaQuery,
        playlistsQuery,
        supabase
          .from('device_detection_logs')
          .select('id, attention_duration')
          .gte('detected_at', todayStart)
          .lte('detected_at', todayEnd),
        supabase
          .from('device_detection_logs')
          .select('id')
          .gte('detected_at', yesterdayStart)
          .lte('detected_at', yesterdayEnd)
      ]);

      const devices = devicesResult.data || [];
      const onlineDevices = devices.filter(d => d.status === 'online' && d.is_active).length;
      const todayDetections = todayDetectionsResult.data || [];
      const yesterdayDetections = yesterdayDetectionsResult.data || [];
      
      const attentionTimes = todayDetections
        .map(d => d.attention_duration)
        .filter((t): t is number => t !== null && t !== undefined);
      const avgAttention = attentionTimes.length > 0 
        ? attentionTimes.reduce((a, b) => a + b, 0) / attentionTimes.length 
        : 0;

      setStats({
        devicesOnline: onlineDevices,
        totalDevices: devices.length,
        activeMedia: mediaResult.data?.length || 0,
        playlistCount: playlistsResult.data?.length || 0,
        audienceToday: todayDetections.length,
        audienceYesterday: yesterdayDetections.length,
        avgAttentionTime: avgAttention
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  }, [tenantId, companyId, isSuperAdmin]);

  const fetchAudienceByHour = useCallback(async () => {
    try {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();

      const { data } = await supabase
        .from('device_detection_logs')
        .select('detected_at')
        .gte('detected_at', todayStart)
        .lte('detected_at', todayEnd);

      if (!data) {
        setAudienceByHour([]);
        return;
      }

      const hourCounts: Record<string, number> = {};
      for (let i = 0; i < 24; i++) {
        hourCounts[`${i.toString().padStart(2, '0')}:00`] = 0;
      }

      data.forEach(d => {
        const hour = new Date(d.detected_at).getHours();
        const hourKey = `${hour.toString().padStart(2, '0')}:00`;
        hourCounts[hourKey]++;
      });

      const hourlyData = Object.entries(hourCounts).map(([hour, people]) => ({
        hour,
        people
      }));

      setAudienceByHour(hourlyData);
    } catch (error) {
      console.error('Error fetching audience by hour:', error);
    }
  }, []);

  const fetchDemographics = useCallback(async () => {
    try {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();

      const { data } = await supabase
        .from('device_detection_logs')
        .select('gender, age_group, emotion')
        .gte('detected_at', todayStart)
        .lte('detected_at', todayEnd);

      if (!data || data.length === 0) {
        setGenderDistribution([
          { name: 'Masculino', value: 0, color: '#22c55e' },
          { name: 'Feminino', value: 0, color: '#3b82f6' },
          { name: 'Indefinido', value: 0, color: '#f59e0b' }
        ]);
        setAgeDistribution([
          { range: '0-12', count: 0 },
          { range: '13-18', count: 0 },
          { range: '19-25', count: 0 },
          { range: '26-35', count: 0 },
          { range: '36-50', count: 0 },
          { range: '51+', count: 0 }
        ]);
        setEmotionData([]);
        return;
      }

      const genderCounts: Record<string, number> = { masculino: 0, feminino: 0, indefinido: 0 };
      data.forEach(d => {
        const gender = d.gender?.toLowerCase();
        if (gender === 'male' || gender === 'masculino') genderCounts.masculino++;
        else if (gender === 'female' || gender === 'feminino') genderCounts.feminino++;
        else genderCounts.indefinido++;
      });
      
      const total = Object.values(genderCounts).reduce((a, b) => a + b, 0);
      setGenderDistribution([
        { name: 'Masculino', value: total > 0 ? Math.round((genderCounts.masculino / total) * 100) : 0, color: '#22c55e' },
        { name: 'Feminino', value: total > 0 ? Math.round((genderCounts.feminino / total) * 100) : 0, color: '#3b82f6' },
        { name: 'Indefinido', value: total > 0 ? Math.round((genderCounts.indefinido / total) * 100) : 0, color: '#f59e0b' }
      ]);

      const ageCounts: Record<string, number> = { '0-12': 0, '13-18': 0, '19-25': 0, '26-35': 0, '36-50': 0, '51+': 0 };
      data.forEach(d => {
        const ageGroup = d.age_group;
        if (!ageGroup) return;

        // Map database values to dashboard categories
        if (ageGroup === 'child' || ageGroup === '0-12') ageCounts['0-12']++;
        else if (ageGroup === 'teen' || ageGroup === '13-18') ageCounts['13-18']++;
        else if (ageGroup === 'young_adult' || ageGroup === '19-25') ageCounts['19-25']++;
        else if (ageGroup === 'adult' || ageGroup === '26-35') ageCounts['26-35']++;
        else if (ageGroup === '36-50') ageCounts['36-50']++;
        else if (ageGroup === 'senior' || ageGroup === '51+') ageCounts['51+']++;
      });
      setAgeDistribution(Object.entries(ageCounts).map(([range, count]) => ({ range, count })));

      const emotionCounts: Record<string, number> = {};
      data.forEach(d => {
        if (d.emotion) emotionCounts[d.emotion] = (emotionCounts[d.emotion] || 0) + 1;
      });
      
      const emotionTotal = Object.values(emotionCounts).reduce((a, b) => a + b, 0);
      setEmotionData(
        Object.entries(emotionCounts)
          .map(([name, count]) => ({
            name: translateEmotion(name),
            count,
            percentage: emotionTotal > 0 ? Math.round((count / emotionTotal) * 100) : 0
          }))
          .sort((a, b) => b.count - a.count)
      );
    } catch (error) {
      console.error('Error fetching demographics:', error);
    }
  }, []);

  const fetchTopContent = useCallback(async () => {
    try {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();

      const { data } = await supabase
        .from('device_detection_logs')
        .select('content_id, content_name, attention_duration, emotion')
        .gte('detected_at', todayStart)
        .lte('detected_at', todayEnd)
        .not('content_id', 'is', null);

      if (!data || data.length === 0) {
        setTopContent([]);
        return;
      }

      const contentStats: Record<string, {
        contentName: string;
        views: number;
        totalAttention: number;
        emotions: Record<string, number>;
      }> = {};

      data.forEach(d => {
        if (!d.content_id) return;
        if (!contentStats[d.content_id]) {
          contentStats[d.content_id] = { contentName: d.content_name || 'Desconhecido', views: 0, totalAttention: 0, emotions: {} };
        }
        contentStats[d.content_id].views++;
        contentStats[d.content_id].totalAttention += d.attention_duration || 0;
        if (d.emotion) {
          contentStats[d.content_id].emotions[d.emotion] = (contentStats[d.content_id].emotions[d.emotion] || 0) + 1;
        }
      });

      setTopContent(
        Object.entries(contentStats)
          .map(([contentId, stats]) => {
            const topEmotion = Object.entries(stats.emotions).sort(([, a], [, b]) => b - a)[0];
            return {
              contentId,
              contentName: stats.contentName,
              views: stats.views,
              avgAttention: stats.views > 0 ? stats.totalAttention / stats.views : 0,
              topEmotion: topEmotion ? translateEmotion(topEmotion[0]) : 'N/A'
            };
          })
          .sort((a, b) => b.views - a.views)
          .slice(0, 5)
      );
    } catch (error) {
      console.error('Error fetching top content:', error);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchStats(), fetchAudienceByHour(), fetchDemographics(), fetchTopContent()]);
    setIsLoading(false);
  }, [fetchStats, fetchAudienceByHour, fetchDemographics, fetchTopContent]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { stats, audienceByHour, genderDistribution, ageDistribution, emotionData, topContent, isLoading, refresh };
};

function translateEmotion(emotion: string): string {
  const translations: Record<string, string> = {
    neutral: 'Neutro', happy: 'Feliz', sad: 'Triste', angry: 'Raiva',
    fearful: 'Medo', disgusted: 'Nojo', surprised: 'Surpreso'
  };
  return translations[emotion] || emotion;
}
