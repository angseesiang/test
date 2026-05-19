import express from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { appendAuditLog, createAssessmentRecord, createId, getAssessmentById, listAssessments } from '../services/storage';
import { generateAssessmentFromInput, titleFromDescription } from '../services/assessmentEngine';
import { Assessment } from '../types';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxFileMb * 1024 * 1024,
    files: env.maxFilesPerAssessment
  }
});

router.get('/', requireAuth, async (req, res) => {
  const assessments = listAssessments();

  const visibleAssessments = req.user?.role === 'admin'
    ? assessments
    : assessments.filter((assessment) => assessment.ownerUserId === req.user?.id);

  return res.json({ ok: true, assessments: visibleAssessments });
});

router.get('/:assessmentId', requireAuth, async (req, res) => {
  const assessment = getAssessmentById(req.params.assessmentId);

  if (!assessment) {
    return res.status(404).json({ ok: false, message: 'Assessment not found.' });
  }

  if (req.user?.role !== 'admin' && assessment.ownerUserId !== req.user?.id) {
    return res.status(403).json({ ok: false, message: 'You do not have access to this assessment.' });
  }

  return res.json({ ok: true, assessment });
});

router.post('/', requireAuth, upload.array('files'), async (req, res) => {
  try {
    const systemDescription = typeof req.body.systemDescription === 'string' ? req.body.systemDescription : '';
    const files = (req.files ?? []) as Express.Multer.File[];

    if (!systemDescription.trim() && files.length === 0) {
      return res.status(400).json({ ok: false, message: 'Please provide a system description or upload at least one file.' });
    }

    const generated = await generateAssessmentFromInput({ systemDescription, files });

    const assessment: Assessment = {
      id: createId('ast'),
      ownerUserId: req.user!.id,
      date: new Date().toISOString(),
      title: titleFromDescription(systemDescription, files),
      systemDescription,
      uploadedFileNames: files.map((file) => file.originalname),
      summary: generated.summary,
      rows: generated.rows
    };

    createAssessmentRecord(assessment);

    appendAuditLog({
      userId: req.user!.id,
      action: 'assessment.create',
      entityType: 'assessment',
      entityId: assessment.id,
      metadata: {
        uploadedFiles: files.length,
        extractedPointCount: generated.summary.extractedPointCount,
        matchingCount: generated.summary.matchingCount,
        notMatchedCount: generated.summary.notMatchedCount
      }
    });

    return res.json({ ok: true, assessment });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Assessment generation failed.' });
  }
});

export default router;
