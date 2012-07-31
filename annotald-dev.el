;;; Copyright (c) 2012 Aaron Ecay

;;; This file is part of the Annotald program for annotating
;;; phrase-structure treebanks in the Penn Treebank style.

;;; This file is distributed under the terms of the GNU General
;;; Public License as published by the Free Software Foundation, either
;;; version 3 of the License, or (at your option) any later version.

;;; This program is distributed in the hope that it will be useful, but
;;; WITHOUT ANY WARRANTY; without even the implied warranty of
;;; MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser
;;; General Public License for more details.

;;; You should have received a copy of the GNU Lesser General Public
;;; License along with this program.  If not, see
;;; <http://www.gnu.org/licenses/>.

;;; Functions for developing Annotald.

(defun annotald-toc ()
  (let* ((b (buffer-substring-no-properties (point-min) (point-max)))
         (toc (with-temp-buffer
                (insert b)
                (goto-char (point-min))
                (keep-lines "^// ======*")
                (replace-regexp "=====" "*")
                (goto-char (point-min))
                (insert "// Table of contents:\n")
                (goto-char (point-max))
                (insert "// End TOC")
                (buffer-substring-no-properties (point-min) (point-max)))))
    toc))

(defun annotald-update-toc ()
  (interactive)
  (let ((p (point)))
    (save-excursion
      (goto-char (point-min))
      (when (search-forward "// Table of contents:" nil t)
        (let ((m (point-at-bol)))
          (when (search-forward "// End TOC")
            (delete-region m (point-at-eol))
            (setq p m))))
      (goto-char p)
      (insert (annotald-toc)))))
