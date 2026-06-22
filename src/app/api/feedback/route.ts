import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { divination_type, prediction_content, feedback_result, feedback_detail, birth_info } = body;

    if (!divination_type || !feedback_result) {
      return NextResponse.json(
        { error: '缺少必填字段：divination_type, feedback_result' },
        { status: 400 }
      );
    }

    const validResults = ['accurate', 'partially_accurate', 'inaccurate', 'pending_verification'];
    if (!validResults.includes(feedback_result)) {
      return NextResponse.json(
        { error: `feedback_result 必须为: ${validResults.join(', ')}` },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('prediction_feedback')
      .insert({
        divination_type,
        prediction_content: prediction_content || null,
        feedback_result,
        feedback_detail: feedback_detail || null,
        birth_info: birth_info || null,
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Feedback insert error:', error);
      return NextResponse.json(
        { error: '反馈提交失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '反馈已提交，感谢您的验证！这将帮助AI不断精进',
      data,
    });
  } catch (err) {
    console.error('Feedback API error:', err);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const divinationType = searchParams.get('divination_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const client = getSupabaseClient();

    let query = client
      .from('prediction_feedback')
      .select('id, divination_type, feedback_result, feedback_detail, birth_info, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (divinationType) {
      query = query.eq('divination_type', divinationType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Feedback query error:', error);
      return NextResponse.json(
        { error: '查询失败' },
        { status: 500 }
      );
    }

    // 统计准确率
    const total = (data || []).length;
    const accurate = (data || []).filter(d => d.feedback_result === 'accurate').length;
    const partial = (data || []).filter(d => d.feedback_result === 'partially_accurate').length;

    return NextResponse.json({
      success: true,
      stats: {
        total,
        accurate,
        partially_accurate: partial,
        accuracy_rate: total > 0 ? Math.round((accurate + partial * 0.5) / total * 100) : 0,
      },
      data,
    });
  } catch (err) {
    console.error('Feedback query API error:', err);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
