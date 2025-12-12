import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Generate task ID
function generateTaskId(): string {
  return `shop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * GET - Get shopping task(s) for a user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const taskId = searchParams.get('taskId');
    const status = searchParams.get('status');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    let query = supabase
      .from('shopping_agent_tasks')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });

    if (taskId) {
      query = query.eq('id', taskId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error('[Shopping Agent] Error fetching tasks:', error);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    // If single task requested
    if (taskId) {
      if (!tasks || tasks.length === 0) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, task: tasks[0] });
    }

    return NextResponse.json({
      success: true,
      tasks: tasks || [],
      count: tasks?.length || 0,
    });
  } catch (error) {
    console.error('[Shopping Agent] Error in GET /tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Create a new shopping task
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, parentTaskId, products, targetSites } = body;

    // Validation
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'Products array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate product structure
    for (const product of products) {
      if (!product.name) {
        return NextResponse.json(
          { error: 'Each product must have a name' },
          { status: 400 }
        );
      }
    }

    console.log(`[Shopping Agent] Creating task for ${email} with ${products.length} products`);

    const taskId = generateTaskId();

    // Create the task
    const { data: task, error } = await supabase
      .from('shopping_agent_tasks')
      .insert({
        id: taskId,
        parent_task_id: parentTaskId || null,
        user_email: email,
        status: 'pending',
        target_site: targetSites?.[0] || 'amazon', // Default to Amazon
        products: products.map((p: any) => ({
          name: p.name,
          dosage: p.dosage || null,
          quantity: p.quantity || 1,
          maxPrice: p.maxPrice || null,
          priority: p.priority || 'normal',
        })),
      })
      .select()
      .single();

    if (error) {
      console.error('[Shopping Agent] Error creating task:', error);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      taskId: task.id,
      status: task.status,
      message: `Shopping task created with ${products.length} products`,
    });
  } catch (error) {
    console.error('[Shopping Agent] Error in POST /tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH - Update shopping task (approve, reject, provide 2FA, retry)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, taskId, action, selectedProducts, twoFACode } = body;

    if (!email || !taskId) {
      return NextResponse.json({ error: 'Email and taskId are required' }, { status: 400 });
    }

    // Fetch task
    const { data: task, error: fetchError } = await supabase
      .from('shopping_agent_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_email', email)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    let updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    switch (action) {
      case 'approve':
        // User approved the selected products for purchase
        if (!selectedProducts || selectedProducts.length === 0) {
          return NextResponse.json(
            { error: 'selectedProducts are required for approval' },
            { status: 400 }
          );
        }

        // Calculate total
        const approvedTotal = selectedProducts.reduce(
          (sum: number, p: any) => sum + (p.price * (p.quantity || 1)),
          0
        );

        updateData = {
          ...updateData,
          status: 'adding_to_cart',
          selected_products: selectedProducts,
          approved_at: new Date().toISOString(),
          approved_total: approvedTotal,
        };
        break;

      case 'reject':
        updateData = {
          ...updateData,
          status: 'cancelled',
        };
        break;

      case 'provide_2fa':
        if (!twoFACode) {
          return NextResponse.json({ error: '2FA code is required' }, { status: 400 });
        }

        // Store 2FA code for processing
        updateData = {
          ...updateData,
          status: 'checking_out', // Resume checkout
          error_details: {
            ...(task.error_details || {}),
            twoFACode,
            twoFAProvidedAt: new Date().toISOString(),
          },
        };
        break;

      case 'retry':
        // Reset error state and retry
        updateData = {
          ...updateData,
          status: task.search_results ? 'awaiting_approval' : 'pending',
          error_type: null,
          error_details: null,
          retry_count: (task.retry_count || 0) + 1,
        };
        break;

      case 'update_site':
        // Change target site
        const { targetSite } = body;
        if (!targetSite) {
          return NextResponse.json({ error: 'targetSite is required' }, { status: 400 });
        }
        updateData = {
          ...updateData,
          target_site: targetSite,
          search_results: null, // Clear old search results
          status: 'pending', // Re-search on new site
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update task
    const { error: updateError } = await supabase
      .from('shopping_agent_tasks')
      .update(updateData)
      .eq('id', taskId);

    if (updateError) {
      console.error('[Shopping Agent] Error updating task:', updateError);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      taskId,
      action,
      newStatus: updateData.status,
    });
  } catch (error) {
    console.error('[Shopping Agent] Error in PATCH /tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Cancel/delete a shopping task
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const taskId = searchParams.get('taskId');

    if (!email || !taskId) {
      return NextResponse.json({ error: 'Email and taskId are required' }, { status: 400 });
    }

    // Soft delete - mark as cancelled
    const { error } = await supabase
      .from('shopping_agent_tasks')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_email', email);

    if (error) {
      console.error('[Shopping Agent] Error deleting task:', error);
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Task cancelled',
    });
  } catch (error) {
    console.error('[Shopping Agent] Error in DELETE /tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
