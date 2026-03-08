/**
 * @typedef {'short' | 'detailed' | 'work_order'} AiQueryMode
 */

/**
 * @typedef {'SUCCESS' | 'FAIL' | 'PARTIAL'} AiFeedbackResult
 */

/**
 * @typedef {{
 *  id: string;
 *  mode: AiQueryMode;
 *  error_code: string | null;
 *  short_answer: string;
 *  detailed_answer: string | null;
 *  work_order_suggestion: null | {
 *    title: string;
 *    machine_id: string | null;
 *    machine_code: string | null;
 *    estimated_duration_min: number | null;
 *    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
 *    steps: string[];
 *    materials: string[];
 *  };
 *  attachments: {
 *    type: 'image' | 'pdf' | 'link';
 *    url: string;
 *    label?: string;
 *  }[];
 * }} AiResponse
 */

